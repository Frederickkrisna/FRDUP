/**
 * Split-bill engine.
 * allocateEvenly: largest-remainder allocation — Σ == total, guaranteed.
 * computeSettlements: full bill computation.
 * See docs/implementation_be.md §6.4.
 */

import type { Id, Rupiah } from '@/types/common';
import type { BillItem, BillDoc, Settlement } from '@/types/bill';
import type { SessionParticipant } from '@/types/session';
import { roundHalfUp } from '@/core/utils/idr';

/**
 * Allocate `total` integer rupiah evenly across `payerIds`.
 * Uses largest-remainder method: Σ allocations === total, always.
 * Order is deterministic (sorted payerIds) so the same bill produces the same split.
 */
export function allocateEvenly(
  total: Rupiah,
  payerIds: Id[],
): Record<Id, Rupiah> {
  const n = payerIds.length;
  if (n === 0) return {};

  const sorted = [...payerIds].sort();
  const base = Math.floor(total / n);
  const remainder = total - base * n;

  const result: Record<Id, Rupiah> = {};
  for (let i = 0; i < sorted.length; i++) {
    result[sorted[i]!] = base + (i < remainder ? 1 : 0);
  }

  return result;
}

export interface ComputeSettlementsArgs {
  items: BillItem[];
  participants: SessionParticipant[];
  roundingTo: Rupiah;
  hostPlayerId: Id | null;
}

export interface SettlementsResult {
  settlements: Settlement[];
  totals: BillDoc['totals'];
}

/**
 * Compute per-player settlements from bill items.
 * See docs/implementation_be.md §6.4.4.
 */
export function computeSettlements({
  items,
  participants,
  roundingTo,
}: ComputeSettlementsArgs): SettlementsResult {
  const billable = participants.filter((p) => p.includeInBill);
  const billableIds = billable.map((p) => p.playerId);

  type LineEntry = { itemId: Id; label: string; amount: Rupiah };
  const lines = new Map<Id, LineEntry[]>();
  for (const p of billable) {
    lines.set(p.playerId, []);
  }

  let grossTotal = 0;

  for (const item of items) {
    const itemTotal = item.unitPrice * item.quantity;
    grossTotal += itemTotal;

    const label = item.customLabel ?? item.labelKey ?? item.id;

    switch (item.kind) {
      case 'court_fee': {
        const alloc = allocateEvenly(itemTotal, billableIds);
        for (const [pid, amt] of Object.entries(alloc)) {
          lines.get(pid)?.push({ itemId: item.id, label, amount: amt as Rupiah });
        }
        break;
      }

      case 'shared':
      case 'rental': {
        const payers = item.payerPlayerIds.filter((id) => billableIds.includes(id));
        if (payers.length === 0 && itemTotal > 0) {
          // Skip silently — callers should validate before calling
          break;
        }
        const alloc = allocateEvenly(itemTotal, payers);
        for (const [pid, amt] of Object.entries(alloc)) {
          lines.get(pid)?.push({ itemId: item.id, label, amount: amt as Rupiah });
        }
        break;
      }

      case 'individual': {
        const payers = item.payerPlayerIds.filter((id) => billableIds.includes(id));
        for (const pid of payers) {
          const qty = item.perPlayerQuantity?.[pid] ?? 1;
          const amt = item.unitPrice * qty;
          lines.get(pid)?.push({ itemId: item.id, label, amount: amt });
        }
        break;
      }
    }
  }

  const settlements: Settlement[] = [];

  for (const p of billable) {
    const playerLines = lines.get(p.playerId) ?? [];
    const subtotal: Rupiah = playerLines.reduce((s, l) => s + l.amount, 0);
    const rounded: Rupiah = roundHalfUp(subtotal, roundingTo);

    settlements.push({
      playerId: p.playerId,
      name: p.name,
      lines: playerLines,
      subtotal,
      rounded,
      roundingDelta: rounded - subtotal,
    });
  }

  const collected = settlements.reduce((s, r) => s + r.rounded, 0);
  const allocated = settlements.reduce((s, r) => s + r.subtotal, 0);

  return {
    settlements,
    totals: {
      gross: grossTotal,
      allocated,
      roundingAbsorbedByHost: grossTotal - collected,
    },
  };
}
