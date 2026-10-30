/** Bill item presets per sport (docs/implementation_fe.md §6.7). Labels are i18n keys under bill.preset.*. */

import type { BillItemKind } from '@/types/bill';
import type { SportId } from '@/types/sport';

export interface BillPreset {
  id: string;
  kind: BillItemKind;
  labelKey: string;
  sports: SportId[];
  /** Suggested quantity when the preset is picked. */
  quantity: number;
}

const ALL: SportId[] = ['padel', 'badminton', 'pingpong', 'billiard', 'mahjong'];

export const BILL_PRESETS: BillPreset[] = [
  { id: 'court', kind: 'court_fee', labelKey: 'bill.preset.courtRental', sports: ALL, quantity: 1 },
  { id: 'shuttlecock', kind: 'shared', labelKey: 'bill.preset.shuttlecock', sports: ['badminton'], quantity: 1 },
  { id: 'balls', kind: 'shared', labelKey: 'bill.preset.balls', sports: ['padel', 'pingpong', 'billiard'], quantity: 1 },
  { id: 'racket', kind: 'rental', labelKey: 'bill.preset.racketRental', sports: ['padel', 'badminton', 'pingpong'], quantity: 2 },
  { id: 'parking', kind: 'shared', labelKey: 'bill.preset.parking', sports: ALL, quantity: 1 },
  { id: 'water', kind: 'shared', labelKey: 'bill.preset.water', sports: ALL, quantity: 1 },
];

export function presetsFor(sportId: SportId): BillPreset[] {
  return BILL_PRESETS.filter((p) => p.sports.includes(sportId));
}
