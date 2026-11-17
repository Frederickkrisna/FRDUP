/**
 * WhatsApp bill export formatter.
 * Renders plain text with WhatsApp markdown (*bold*, _italic_).
 * Target: pasteable into a group chat, readable on one screen.
 * See docs/implementation_be.md §6.4.5.
 */

import type { SessionDoc } from '@/types/session';
import type { BillDoc } from '@/types/bill';
import type { HostDoc } from '@/types/host';
import type { StandingRow } from '@/core/matchmaking/types';
import { standingPoints } from '@/core/standings/computeStandings';
import { formatIdr } from '@/core/utils/idr';
import { formatDateWithDay } from '@/core/utils/date';

const SPORT_EMOJI: Record<string, string> = {
  padel: '🎾',
  badminton: '🏸',
  pingpong: '🏓',
  billiard: '🎱',
  mahjong: '🀄',
};

const PODIUM: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export interface FormatWhatsappArgs {
  session: SessionDoc;
  bill: BillDoc;
  host: HostDoc;
  standings: StandingRow[];
  locale: 'id' | 'en';
  /** Localised sport name (core has no i18n). Falls back to the capitalised sport id. */
  sportName?: string;
}

export function formatWhatsappMessage({
  session,
  bill,
  host,
  standings,
  locale,
  sportName: sportNameOverride,
}: FormatWhatsappArgs): string {
  const sportEmoji = SPORT_EMOJI[session.sportId] ?? '🏅';
  const dateStr = formatDateWithDay(session.playedAt, locale);
  const venue = session.venue ? `📍 ${session.venue} · ` : '';

  const lines: string[] = [];

  // Header
  const sportName = sportNameOverride ?? session.sportId.charAt(0).toUpperCase() + session.sportId.slice(1);
  lines.push(`${sportEmoji} *${sportName} — ${dateStr}*`);

  const participantCount = session.participants.length;
  const roundCount = session.completedRoundCount;
  const participantInfo = locale === 'id'
    ? `${venue}${roundCount} ronde · ${participantCount} pemain`
    : `${venue}${roundCount} rounds · ${participantCount} players`;
  lines.push(participantInfo);
  lines.push('');

  // Standings
  const standingsTitle = locale === 'id' ? '🏆 *Klasemen*' : '🏆 *Standings*';
  lines.push(standingsTitle);

  const top = standings.slice(0, 5);
  const pidToName = new Map(session.participants.map((p) => [p.playerId, p.nickname ?? p.name]));

  for (const row of top) {
    const emoji = PODIUM[row.rank] ?? `${row.rank}.`;
    const name = pidToName.get(row.playerId) ?? row.playerId;
    const stats = locale === 'id'
      ? `${standingPoints(row)} poin (${row.wins}M-${row.losses}K)`
      : `${standingPoints(row)} pts (${row.wins}W-${row.losses}L)`;
    lines.push(`${emoji} ${name} — ${stats}`);
  }

  if (standings.length > 5) {
    const more = standings.length - 5;
    lines.push(locale === 'id' ? `_...dan ${more} pemain lainnya_` : `_...and ${more} more players_`);
  }
  lines.push('');

  // Bill breakdown
  if (bill.items.length > 0) {
    const billTitle = locale === 'id' ? '💰 *Rincian Biaya*' : '💰 *Bill Breakdown*';
    lines.push(billTitle);

    for (const item of bill.items) {
      const label = item.customLabel ?? item.labelKey ?? '';
      const total = formatIdr(item.unitPrice * item.quantity);
      lines.push(`${label} ${dotLeader(label, total)} ${total}`);
    }

    lines.push('─────────────────────────────');
    const totalLabel = locale === 'id' ? 'Total' : 'Total';
    const totalStr = formatIdr(bill.totals.gross);
    lines.push(`${totalLabel} ${dotLeader(totalLabel, totalStr)} ${totalStr}`);
    lines.push('');

    // Per-person amounts
    const amountsTitle = locale === 'id' ? '💸 *Yang Harus Dibayar*' : '💸 *Amount Due*';
    lines.push(amountsTitle);

    for (const s of bill.settlements) {
      const name = pidToName.get(s.playerId) ?? s.name;
      const amount = formatIdr(s.rounded);
      lines.push(`• ${name} ${dotLeader('• ' + name, amount)} ${amount}`);
    }
    lines.push('');

    // Payment info
    const { payment } = host;
    if (payment.bankName && payment.accountNumber) {
      const payTitle = locale === 'id' ? '🏦 *Transfer ke*' : '🏦 *Transfer to*';
      lines.push(payTitle);
      lines.push(`${payment.bankName} ${payment.accountNumber}`);
      if (payment.accountHolder) lines.push(`a.n. ${payment.accountHolder}`);
      if (payment.qrisImageUrl) {
        lines.push(locale === 'id' ? '_atau scan QRIS di gambar_' : '_or scan the QRIS image_');
      }
      lines.push('');
    }
  }

  // Footer
  const footer = locale === 'id'
    ? 'Makasih semuanya! Sampai ketemu lagi 🙌'
    : 'Thanks everyone! See you next time 🙌';
  lines.push(footer);

  return lines.join('\n');
}

/** Generates dot-leader padding for visual alignment. WhatsApp fonts are proportional — keep it short. */
function dotLeader(label: string, value: string): string {
  const total = 36;
  const used = label.length + value.length;
  const dots = Math.max(1, total - used);
  return '.'.repeat(dots);
}
