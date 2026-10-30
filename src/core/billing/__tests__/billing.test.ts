/**
 * Billing engine tests.
 * Includes the spec worked example: 9 participants, 2 rackets @ 25.000, 3 brought own → 6 payers.
 * Invariant: Σ settlements.rounded + roundingAbsorbedByHost === totals.gross (fuzzed).
 */

import { describe, it, expect } from 'vitest';
import { allocateEvenly, computeSettlements } from '../splitEngine';
import type { SessionParticipant } from '@/types/session';
import type { BillItem } from '@/types/bill';

function participant(id: string): SessionParticipant {
  return {
    playerId: id, name: id, nickname: null, avatarColor: '#fff',
    isGuest: false, joinedAtRound: 1, leftAtRound: null,
    includeInRanking: true, includeInBill: true,
  };
}

describe('allocateEvenly', () => {
  it('splits evenly with no remainder', () => {
    const result = allocateEvenly(90_000, ['A', 'B', 'C']);
    expect(result['A']).toBe(30_000);
    expect(result['B']).toBe(30_000);
    expect(result['C']).toBe(30_000);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(90_000);
  });

  it('distributes remainder by 1 to first payers', () => {
    const result = allocateEvenly(100_000, ['A', 'B', 'C']);
    const values = Object.values(result);
    const total = values.reduce((s, v) => s + v, 0);
    expect(total).toBe(100_000);
    // At most 2 different values, differing by 1
    const unique = new Set(values);
    expect(unique.size).toBeLessThanOrEqual(2);
  });

  it('Σ always equals total for random inputs', () => {
    for (let i = 0; i < 500; i++) {
      const total = Math.floor(Math.random() * 1_000_000) + 1;
      const n = Math.floor(Math.random() * 20) + 1;
      const payers = Array.from({ length: n }, (_, j) => `P${j}`);
      const alloc = allocateEvenly(total, payers);
      const sum = Object.values(alloc).reduce((s, v) => s + v, 0);
      expect(sum).toBe(total);
    }
  });

  it('returns empty for empty payers', () => {
    expect(allocateEvenly(50_000, [])).toEqual({});
  });

  it('deterministic: same total + payers = same result', () => {
    const r1 = allocateEvenly(77_777, ['X', 'Y', 'Z']);
    const r2 = allocateEvenly(77_777, ['X', 'Y', 'Z']);
    expect(r1).toEqual(r2);
  });
});

describe('computeSettlements — spec example', () => {
  it('9 participants, 2 rackets @ 25.000, 3 brought own → 6 payers, exact 50.000 total', () => {
    const players = Array.from({ length: 9 }, (_, i) => `P${i}`);
    const participants = players.map(participant);

    // 3 players brought their own racket — they are excluded from payers
    const broughtOwnIds = ['P0', 'P1', 'P2'];
    const rentalPayers = players.filter((id) => !broughtOwnIds.includes(id)); // 6 players

    const items: BillItem[] = [
      {
        id: 'racket-rental',
        kind: 'rental',
        labelKey: 'bill.preset.racketRental',
        customLabel: null,
        unitPrice: 25_000,
        quantity: 2,
        payerPlayerIds: rentalPayers,
      },
    ];

    const { settlements, totals } = computeSettlements({
      items,
      participants,
      roundingTo: 500,
      hostPlayerId: null,
    });

    // Total should be 50.000
    expect(totals.gross).toBe(50_000);

    // Only the 6 payers should have a non-zero amount
    const paying = settlements.filter((s) => s.subtotal > 0);
    expect(paying).toHaveLength(6);

    const nonPaying = settlements.filter((s) => s.subtotal === 0);
    expect(nonPaying).toHaveLength(3);

    // Sum of subtotals = gross
    const subtotalSum = settlements.reduce((s, r) => s + r.subtotal, 0);
    expect(subtotalSum).toBe(50_000);

    // Σ rounded + absorbed = gross
    const roundedSum = settlements.reduce((s, r) => s + r.rounded, 0);
    expect(roundedSum + totals.roundingAbsorbedByHost).toBe(totals.gross);
  });
});

describe('computeSettlements — invariant Σ == gross', () => {
  it('holds over 1000 random bills', () => {
    for (let trial = 0; trial < 1000; trial++) {
      const n = Math.floor(Math.random() * 9) + 2; // 2..10
      const players = Array.from({ length: n }, (_, i) => `P${i}`);
      const participants = players.map(participant);

      const items: BillItem[] = [
        {
          id: 'court',
          kind: 'court_fee',
          labelKey: null,
          customLabel: 'Court',
          unitPrice: Math.floor(Math.random() * 500_000) + 50_000,
          quantity: 1,
          payerPlayerIds: [],
        },
      ];

      const roundingTo = [100, 500, 1000][Math.floor(Math.random() * 3)] ?? 500;
      const { settlements, totals } = computeSettlements({
        items, participants, roundingTo, hostPlayerId: null,
      });

      const roundedSum = settlements.reduce((s, r) => s + r.rounded, 0);
      expect(roundedSum + totals.roundingAbsorbedByHost).toBe(totals.gross);
    }
  });
});

describe('computeSettlements — all four item kinds', () => {
  const players = ['A', 'B', 'C', 'D'].map(participant);

  it('court_fee splits across all billable', () => {
    const items: BillItem[] = [{
      id: 'c1', kind: 'court_fee', labelKey: null, customLabel: 'Court',
      unitPrice: 200_000, quantity: 1, payerPlayerIds: [],
    }];
    const { settlements } = computeSettlements({ items, participants: players, roundingTo: 500, hostPlayerId: null });
    const sum = settlements.reduce((s, r) => s + r.subtotal, 0);
    expect(sum).toBe(200_000);
    for (const s of settlements) {
      expect(s.subtotal).toBeGreaterThan(0);
    }
  });

  it('shared splits only among specified subset', () => {
    const items: BillItem[] = [{
      id: 's1', kind: 'shared', labelKey: null, customLabel: 'Water',
      unitPrice: 10_000, quantity: 1, payerPlayerIds: ['A', 'B'],
    }];
    const { settlements } = computeSettlements({ items, participants: players, roundingTo: 500, hostPlayerId: null });
    const a = settlements.find((s) => s.playerId === 'A')!;
    const c = settlements.find((s) => s.playerId === 'C')!;
    expect(a.subtotal).toBe(5_000);
    expect(c.subtotal).toBe(0);
  });

  it('individual charges each payer their own amount', () => {
    const items: BillItem[] = [{
      id: 'i1', kind: 'individual', labelKey: null, customLabel: 'Parking',
      unitPrice: 10_000, quantity: 1, payerPlayerIds: ['A', 'C'],
      perPlayerQuantity: { A: 2, C: 1 },
    }];
    const { settlements } = computeSettlements({ items, participants: players, roundingTo: 500, hostPlayerId: null });
    const a = settlements.find((s) => s.playerId === 'A')!;
    const c = settlements.find((s) => s.playerId === 'C')!;
    const b = settlements.find((s) => s.playerId === 'B')!;
    expect(a.subtotal).toBe(20_000);
    expect(c.subtotal).toBe(10_000);
    expect(b.subtotal).toBe(0);
  });
});
