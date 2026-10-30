/** Host document DTO. Mirrors docs/api_contract.md §4.1. */

import type { Id, Millis, Rupiah } from './common';
import type { SportId } from './sport';

export interface HostDoc {
  id: Id;
  schemaVersion: number;
  displayName: string;
  anonUid: string;
  deviceLabel: string;
  locale: 'id' | 'en';
  currency: 'IDR';
  /** Bill rounding granularity: 100 | 500 | 1000 */
  roundingTo: Rupiah;
  payment: {
    bankName: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
    qrisImageUrl: string | null;
    note: string | null;
  };
  sportDefaults: Partial<Record<SportId, Record<string, number | boolean | string>>>;
  defaultSportId: SportId | null;
  createdAt: Millis;
  updatedAt: Millis;
}
