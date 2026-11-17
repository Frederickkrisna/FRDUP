/**
 * Session recap as a PDF: final standings, then every played round with its scores.
 * The report is plain data (testable, no DOM); jsPDF is imported only when the host taps the button.
 */

import type { TFunction } from 'i18next';

import type { StandingRow } from '@/core/matchmaking/types';
import { playedRounds } from '@/core/session/finish';
import { getSportPlugin } from '@/core/sports/registry';
import { standingPoints } from '@/core/standings/computeStandings';
import { formatDateWithDay, toIsoDate } from '@/core/utils/date';
import { displayName } from '@/features/shared/people';
import type { RoundDoc } from '@/types/round';
import type { SessionDoc } from '@/types/session';

export interface SessionReport {
  title: string;
  subtitle: string;
  standingsTitle: string;
  head: string[];
  rows: string[][];
  roundsTitle: string;
  rounds: Array<{ title: string; matches: Array<{ court: string; teams: string[]; score: string[] | null; note: string | null }>; rest: string | null }>;
  footer: string;
  filename: string;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

export function sessionReport(args: { session: SessionDoc; rounds: RoundDoc[]; standings: StandingRow[]; t: TFunction }): SessionReport {
  const { session, rounds, standings, t } = args;
  const plugin = getSportPlugin(session.sportId);
  const byId = new Map(session.participants.map((p) => [p.playerId, p]));
  const name = (id: string): string => {
    const p = byId.get(id);
    return (p && latin1(displayName(p))) || '?'; // cleaned here, so joins like "A & B" never keep a stray space
  };
  const courtLabel = new Map(session.courts.map((c) => [c.id, c.label]));
  const hasDraws = standings.some((s) => s.draws > 0);
  const hasComp = standings.some((s) => s.compensation !== 0);
  const sport = t(plugin.nameKey);

  const head = [
    t('session.standings.rank'),
    t('session.standings.player'),
    t('session.standings.playedShort'),
    hasDraws ? t('session.standings.recordDraws') : t('session.standings.record'),
    t('session.standings.points'),
    ...(hasComp ? [t('session.finish.pdf.compensation')] : []),
    t('session.standings.diff'),
  ];
  const rows = standings
    .filter((s) => s.matchesPlayed > 0)
    .map((s) => [
      String(s.rank),
      name(s.playerId),
      String(s.matchesPlayed),
      hasDraws ? `${s.wins}-${s.losses}-${s.draws}` : `${s.wins}-${s.losses}`,
      String(standingPoints(s)),
      ...(hasComp ? [s.compensation !== 0 ? signed(s.compensation) : ''] : []),
      signed(s.pointDiff),
    ]);

  const played = [...playedRounds(rounds)].sort((a, b) => a.roundNumber - b.roundNumber);
  return {
    title: session.title || sport,
    subtitle: [sport, formatDateWithDay(session.playedAt, 'id'), session.venue].filter(Boolean).join('  ·  '),
    standingsTitle: t('session.standings.title'),
    head,
    rows,
    roundsTitle: t('session.finish.pdf.rounds'),
    rounds: played.map((r) => ({
      title: t('session.court.ronde', { number: r.roundNumber }),
      matches: r.matches.map((m) => ({
        court: courtLabel.get(m.courtId) ?? '',
        teams: m.teams.map((team) => team.map(name).join(' & ')),
        score: m.status === 'completed' ? m.score.points.map(String) : null,
        note: m.status === 'voided' ? t('session.court.status.voided') : m.status === 'completed' ? null : '-',
      })),
      rest: r.restingPlayerIds.length ? t('session.finish.pdf.rest', { names: r.restingPlayerIds.map(name).join(', ') }) : null,
    })),
    footer: t('session.finish.pdf.footer'),
    filename: `frdup-${session.sportId}-${toIsoDate(session.playedAt)}.pdf`,
  };
}

/* ---------------------------------------------------------------------------------- render */

type Rgb = [number, number, number];
const INK: Rgb = [24, 24, 27];
const MUTED: Rgb = [113, 113, 122];
const ZEBRA: Rgb = [244, 244, 245];
const RULE: Rgb = [212, 212, 216];

/** The built-in PDF fonts only carry Latin-1; anything else (emoji, CJK) would print as garbage. */
const latin1 = (s: string): string => s.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '').replace(/ {2,}/g, ' ').trim();

export async function renderSessionPdf(report: SessionReport): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  let y = M;

  const font = (size: number, style: 'normal' | 'bold', color: Rgb = INK) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const fit = (s: string, width: number): string => {
    let out = latin1(s);
    if (doc.getTextWidth(out) <= width) return out;
    while (out.length > 1 && doc.getTextWidth(`${out}..`) > width) out = out.slice(0, -1);
    return `${out.trimEnd()}..`;
  };
  const room = (h: number) => {
    if (y + h <= H - M - 6) return;
    doc.addPage();
    y = M;
  };

  font(18, 'bold');
  doc.text(fit(report.title, W - 2 * M), M, y + 6);
  y += 11;
  font(10, 'normal', MUTED);
  doc.text(fit(report.subtitle, W - 2 * M), M, y + 3);
  y += 10;

  // Standings: the player column takes whatever the number columns leave.
  const numW = 17;
  const rankW = 9;
  const nameW = W - 2 * M - rankW - numW * (report.head.length - 2);
  const colX = (i: number) => (i === 0 ? M : i === 1 ? M + rankW : M + rankW + nameW + numW * (i - 2));
  const cell = (text: string, i: number, rowY: number) => {
    if (i === 1) doc.text(fit(text, nameW - 2), colX(i), rowY);
    else doc.text(latin1(text), colX(i) + (i === 0 ? 0 : numW / 2), rowY, { align: i === 0 ? 'left' : 'center' });
  };

  font(13, 'bold');
  doc.text(latin1(report.standingsTitle), M, y + 4);
  y += 9;
  font(8, 'bold', MUTED);
  report.head.forEach((h, i) => cell(h.toUpperCase(), i, y));
  y += 2.5;
  doc.setDrawColor(...RULE);
  doc.line(M, y, W - M, y);
  y += 1;
  report.rows.forEach((row, n) => {
    room(7);
    if (n % 2 === 1) {
      doc.setFillColor(...ZEBRA);
      doc.rect(M, y, W - 2 * M, 7, 'F');
    }
    font(10, 'normal');
    row.forEach((c, i) => {
      font(10, i === 1 || i === 4 ? 'bold' : 'normal');
      cell(c, i, y + 4.8);
    });
    y += 7;
  });

  // Rounds: one line per match, teams either side of the score.
  y += 8;
  room(16);
  font(13, 'bold');
  doc.text(latin1(report.roundsTitle), M, y + 4);
  y += 8;
  const courtW = 28;
  const mid = M + courtW + (W - 2 * M - courtW) / 2;
  const sideW = (W - 2 * M - courtW) / 2 - 12;
  for (const round of report.rounds) {
    room(8 + round.matches.length * 6 + (round.rest ? 5 : 0));
    y += 2;
    font(10, 'bold');
    doc.text(latin1(round.title), M, y + 4);
    y += 6;
    doc.setDrawColor(...RULE);
    doc.line(M, y, W - M, y);
    y += 1;
    for (const m of round.matches) {
      font(9, 'normal', MUTED);
      doc.text(fit(m.court, courtW - 2), M, y + 4);
      font(9.5, 'normal');
      if (m.teams.length === 2) {
        doc.text(fit(m.teams[0] ?? '', sideW), mid - 12, y + 4, { align: 'right' });
        doc.text(fit(m.teams[1] ?? '', sideW), mid + 12, y + 4);
        font(10, 'bold');
        doc.text(m.score ? m.score.join(' - ') : latin1(m.note ?? ''), mid, y + 4, { align: 'center' });
      } else {
        const parts = m.teams.map((team, i) => (m.score ? `${team} ${m.score[i] ?? ''}` : team));
        doc.text(fit(m.score ? parts.join('   ') : `${parts.join(', ')}  ${m.note ?? ''}`, W - 2 * M - courtW), M + courtW, y + 4);
      }
      y += 6;
    }
    if (round.rest) {
      font(8.5, 'normal', MUTED);
      doc.text(fit(round.rest, W - 2 * M), M + courtW, y + 3.5);
      y += 5;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    font(8, 'normal', MUTED);
    doc.text(latin1(report.footer), M, H - M + 2);
    doc.text(`${p}/${pages}`, W - M, H - M + 2, { align: 'right' });
  }
  return doc.output('blob');
}

/** Native share sheet with the file when the browser can, otherwise a download. */
export async function sharePdf(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Share refused (e.g. no user activation left after rendering): fall through to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
