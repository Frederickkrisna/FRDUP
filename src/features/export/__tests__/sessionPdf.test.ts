import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { buildSchedule, completeMatch, setMatchScore } from '@/core/session/sessionEngine';
import { getSportPlugin } from '@/core/sports/registry';
import { computeStandings } from '@/core/standings/computeStandings';
import { makeSession } from '@/core/session/__tests__/helpers';
import type { RoundDoc } from '@/types/round';
import { renderSessionPdf, sessionReport } from '../sessionPdf';

// Echo the key and its values, so assertions do not depend on the copy.
const t = ((key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key)) as unknown as TFunction;

function playedSession() {
  const plugin = getSportPlugin('padel');
  const session = { ...makeSession('padel', 9, 2), targetRounds: 3, title: 'Jumat Malam' };
  const spec = session.scoreInput;
  const all = buildSchedule({ session, plugin, count: 3, seed: 7, uid: 'h', now: 1 });
  // Rounds 1 and 2 played (21 total: 15-6 everywhere), round 3 never started.
  const play = (r: RoundDoc) =>
    r.matches.reduce((acc, m) => completeMatch(setMatchScore(acc, m.id, { teamIndex: 0, value: 15, mode: 'set' }, plugin, spec, 'h', 2), m.id, plugin, spec, 'h', 3), r);
  const rounds = [play(all[0] as RoundDoc), play(all[1] as RoundDoc), all[2] as RoundDoc];
  const standings = computeStandings(session.participants, rounds, plugin, spec);
  return { session, rounds, standings };
}

describe('sessionReport', () => {
  it('lists played rounds only, with scores, and every player who played', () => {
    const { session, rounds, standings } = playedSession();
    const report = sessionReport({ session, rounds, standings, t });
    expect(report.title).toBe('Jumat Malam');
    expect(report.rounds.map((r) => r.title)).toEqual(['session.court.ronde:1', 'session.court.ronde:2']);
    expect(report.rounds[0]?.matches[0]?.score).toEqual(['15', '6']);
    expect(report.rounds[0]?.rest).toMatch(/^session\.finish\.pdf\.rest:/);
    expect(report.rows).toHaveLength(9);
    expect(report.filename).toBe('frdup-padel-2023-11-15.pdf'); // playedAt rendered in Asia/Jakarta
  });

  it('adds the +M column only when somebody is compensated', () => {
    const { session, rounds, standings } = playedSession();
    // 9 players, 8 per round, 2 rounds: two players sit out once and get +M.
    const hasComp = standings.some((s) => s.compensation !== 0);
    expect(hasComp).toBe(true);
    const report = sessionReport({ session, rounds, standings, t });
    expect(report.head.includes('session.finish.pdf.compensation')).toBe(hasComp);
    expect(report.rows.every((r) => r.length === report.head.length)).toBe(true);
  });
});

describe('renderSessionPdf', () => {
  it('produces a PDF file', async () => {
    const { session, rounds, standings } = playedSession();
    const blob = await renderSessionPdf(sessionReport({ session, rounds, standings, t }));
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
