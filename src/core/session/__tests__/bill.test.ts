import { describe, expect, it } from 'vitest';
import type { BillItem } from '@/types/bill';
import { billIssues, newBill, recomputeBill, rentalCaption, rentalPayers, upsertItem } from '../bill';
import { makeParticipants } from './helpers';

const people = makeParticipants(9);

const racket = (payers: string[]): BillItem => ({
  id: 'r1',
  kind: 'rental',
  labelKey: 'bill.preset.racket',
  customLabel: 'Sewa raket',
  unitPrice: 25_000,
  quantity: 2,
  payerPlayerIds: payers,
});

describe('bill helpers', () => {
  it('the spec case: 9 players, 2 rackets @ 25.000, 3 brought their own → 6 payers, exactly 50.000', () => {
    const payers = rentalPayers(people, ['p1', 'p2', 'p3']);
    expect(payers).toHaveLength(6);
    let bill = newBill({ sessionId: 's', hostId: 'h', roundingTo: 500, hostPlayerId: 'p9', now: 1 });
    bill = { ...bill, items: [racket(payers)] };
    const out = recomputeBill(bill, people, 2);
    const total = out.settlements.reduce((n, s) => n + s.subtotal, 0);
    expect(total).toBe(50_000);
    expect(out.totals.gross).toBe(50_000);
    const amounts = out.settlements.map((s) => s.subtotal).filter((n) => n > 0).sort();
    expect(amounts).toEqual([8333, 8333, 8333, 8333, 8334, 8334]);
    expect(rentalCaption(bill.items[0]!)).toEqual({ quantity: 2, unitPrice: 25_000, payers: 6, perPerson: 8334 });
  });

  it('flags a shared/rental item with no payers instead of throwing', () => {
    expect(billIssues([racket([])], people)).toEqual([{ itemId: 'r1', key: 'bill.error.noPayers' }]);
    expect(billIssues([racket(['p1'])], people)).toEqual([]);
    expect(billIssues([{ ...racket(['p1']), unitPrice: -5 }], people)).toEqual([{ itemId: 'r1', key: 'bill.error.invalidAmount' }]);
    expect(billIssues([{ ...racket(['p1']), quantity: 0 }], people)).toEqual([{ itemId: 'r1', key: 'bill.error.invalidQuantity' }]);
  });

  it('excludes non-billable participants from rental payers', () => {
    const mixed = people.map((p, i) => (i === 0 ? { ...p, includeInBill: false } : p));
    expect(rentalPayers(mixed, [])).toHaveLength(8);
  });

  it('upsertItem replaces by id or appends', () => {
    const a = racket(['p1']);
    expect(upsertItem([a], { ...a, quantity: 3 })[0]!.quantity).toBe(3);
    expect(upsertItem([a], { ...a, id: 'other' })).toHaveLength(2);
  });

  it('rounding: collected + absorbed-by-host === gross', () => {
    let bill = newBill({ sessionId: 's', hostId: 'h', roundingTo: 1000, hostPlayerId: null, now: 1 });
    bill = { ...bill, items: [{ ...racket(people.map((p) => p.playerId)), unitPrice: 41_667, quantity: 1, kind: 'court_fee' }] };
    const out = recomputeBill(bill, people, 2);
    const collected = out.settlements.reduce((n, s) => n + s.rounded, 0);
    expect(collected + out.totals.roundingAbsorbedByHost).toBe(out.totals.gross);
  });
});
