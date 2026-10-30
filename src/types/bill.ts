/** Bill and settlement DTOs. Mirrors docs/api_contract.md §4.7. */

import type { Id, Millis, Rupiah } from './common';

export type BillItemKind =
  | 'court_fee'   // split across all billable participants
  | 'shared'      // shuttlecock, water, parking — split across a chosen subset
  | 'rental'      // gear rental — qty × unitPrice, split across an assigned subset
  | 'individual'; // charged wholly to specific players

export interface BillItem {
  id: Id;
  kind: BillItemKind;
  /** i18n key for preset items, e.g. 'bill.preset.shuttlecock'. */
  labelKey: string | null;
  customLabel: string | null;
  unitPrice: Rupiah;
  quantity: number;
  /**
   * Who pays for this item.
   * - court_fee  → ignored; engine uses all billable participants
   * - shared     → explicit playerId list
   * - rental     → players who did NOT bring their own gear
   * - individual → explicit list, each pays full unitPrice × their own qty
   */
  payerPlayerIds: Id[];
  /** individual only: per-player quantity override. */
  perPlayerQuantity?: Record<Id, number>;
}

export interface Settlement {
  playerId: Id;
  name: string;
  lines: Array<{
    itemId: Id;
    label: string;
    amount: Rupiah;
  }>;
  subtotal: Rupiah;
  /** What they actually transfer after rounding. */
  rounded: Rupiah;
  roundingDelta: Rupiah;
}

export interface BillDoc {
  id: 'bill';
  schemaVersion: number;
  sessionId: Id;
  hostId: Id;
  currency: 'IDR';
  roundingTo: Rupiah;
  items: BillItem[];
  /** Computed output — persisted so history recaps need no recomputation. */
  settlements: Settlement[];
  totals: {
    gross: Rupiah;
    allocated: Rupiah;
    roundingAbsorbedByHost: Rupiah;
  };
  hostPlayerId: Id | null;
  note: string | null;
  createdAt: Millis;
  updatedAt: Millis;
}
