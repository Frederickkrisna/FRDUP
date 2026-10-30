/** Bill document helpers: validation + recompute. Pure; the store calls these on every edit. */

import type { Id, Millis, Rupiah } from '@/types/common';
import type { BillDoc, BillItem } from '@/types/bill';
import type { SessionParticipant } from '@/types/session';
import { computeSettlements } from '@/core/billing/splitEngine';
import { SCHEMA_VERSION } from './sessionEngine';

export function newBill(args: {
  sessionId: Id;
  hostId: Id;
  roundingTo: Rupiah;
  hostPlayerId: Id | null;
  now: Millis;
}): BillDoc {
  return {
    id: 'bill',
    schemaVersion: SCHEMA_VERSION,
    sessionId: args.sessionId,
    hostId: args.hostId,
    currency: 'IDR',
    roundingTo: args.roundingTo,
    items: [],
    settlements: [],
    totals: { gross: 0, allocated: 0, roundingAbsorbedByHost: 0 },
    hostPlayerId: args.hostPlayerId,
    note: null,
    createdAt: args.now,
    updatedAt: args.now,
  };
}

export interface BillIssue {
  itemId: Id;
  /** i18n key. */
  key: 'bill.error.noPayers' | 'bill.error.invalidAmount' | 'bill.error.invalidQuantity';
}

export function billIssues(items: BillItem[], participants: SessionParticipant[]): BillIssue[] {
  const billable = new Set(participants.filter((p) => p.includeInBill).map((p) => p.playerId));
  const issues: BillIssue[] = [];
  for (const item of items) {
    if (!Number.isInteger(item.unitPrice) || item.unitPrice < 0) issues.push({ itemId: item.id, key: 'bill.error.invalidAmount' });
    else if (!Number.isInteger(item.quantity) || item.quantity < 1) issues.push({ itemId: item.id, key: 'bill.error.invalidQuantity' });
    else if (
      (item.kind === 'shared' || item.kind === 'rental') &&
      item.unitPrice * item.quantity > 0 &&
      !item.payerPlayerIds.some((id) => billable.has(id))
    ) {
      issues.push({ itemId: item.id, key: 'bill.error.noPayers' });
    }
  }
  return issues;
}

/** Recomputes settlements + totals from the items. Items with issues still count toward the gross. */
export function recomputeBill(bill: BillDoc, participants: SessionParticipant[], now: Millis): BillDoc {
  const { settlements, totals } = computeSettlements({
    items: bill.items,
    participants,
    roundingTo: bill.roundingTo,
    hostPlayerId: bill.hostPlayerId,
  });
  return { ...bill, settlements, totals, updatedAt: now };
}

export function upsertItem(items: BillItem[], item: BillItem): BillItem[] {
  return items.some((i) => i.id === item.id) ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item];
}

/**
 * "Bawa sendiri" model for rentals: the UI toggles who brought their own gear; the payers are
 * everyone billable minus those players. (implementation_be.md §6.4.2)
 */
export function rentalPayers(participants: SessionParticipant[], broughtOwn: Id[]): Id[] {
  const own = new Set(broughtOwn);
  return participants.filter((p) => p.includeInBill && !own.has(p.playerId)).map((p) => p.playerId);
}

/** Plain-language arithmetic caption data: "2 raket × Rp 25.000 dibagi 6 orang = Rp 8.334/orang". */
export function rentalCaption(item: BillItem): { quantity: number; unitPrice: Rupiah; payers: number; perPerson: Rupiah } | null {
  if (item.payerPlayerIds.length === 0) return null;
  const total = item.unitPrice * item.quantity;
  return {
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    payers: item.payerPlayerIds.length,
    perPerson: Math.ceil(total / item.payerPlayerIds.length),
  };
}
