import type { TFunction } from 'i18next';

import type { BillDoc } from '@/types/bill';
import type { HostDoc } from '@/types/host';
import type { SessionDoc } from '@/types/session';
import type { StandingRow } from '@/core/matchmaking/types';
import { formatWhatsappMessage } from '@/core/billing/formatWhatsapp';
import { getSportPlugin } from '@/core/sports/registry';
import { formatDateWithDay, toIsoDate } from '@/core/utils/date';
import { formatIdr } from '@/core/utils/idr';
import { displayName } from '@/features/shared/people';
import { billCardFormat, type BillCardData } from './BillCard';

export function whatsappText(args: { session: SessionDoc; bill: BillDoc; host: HostDoc; standings: StandingRow[]; t: TFunction }): string {
  const { session, bill, host, standings, t } = args;
  return formatWhatsappMessage({
    session,
    bill,
    host,
    standings,
    locale: 'id',
    sportName: t(getSportPlugin(session.sportId).nameKey),
  });
}

/** "Selisih pembulatan: +Rp 1.500 (ditanggung kamu)" — shown explicitly, never hidden. */
export function roundingLine(bill: BillDoc, t: TFunction): string | null {
  const d = bill.totals.roundingAbsorbedByHost;
  if (d === 0) return null;
  return t('bill.roundingLine', { amount: `${d > 0 ? '+' : '-'}${formatIdr(Math.abs(d))}` });
}

export function billCardData(args: { session: SessionDoc; bill: BillDoc; host: HostDoc; t: TFunction }): { data: BillCardData; format: ReturnType<typeof billCardFormat> } {
  const { session, bill, host, t } = args;
  const byId = new Map(session.participants.map((p) => [p.playerId, p]));
  const pay = host.payment;
  const payLines = [pay.bankName, pay.accountNumber, pay.accountHolder ? t('bill.accountHolderLine', { name: pay.accountHolder }) : null, pay.note].filter((x): x is string => !!x);
  const sport = t(getSportPlugin(session.sportId).nameKey);
  const rows = bill.settlements.map((s) => {
    const p = byId.get(s.playerId);
    return { name: p ? displayName(p) : s.name, amount: formatIdr(s.rounded) };
  });
  return {
    format: billCardFormat(rows.length),
    data: {
      sportName: sport,
      title: session.title || t('bill.title'),
      subtitle: session.venue,
      dateLabel: formatDateWithDay(session.playedAt, 'id'),
      items: bill.items.map((i) => ({ label: i.customLabel ?? i.labelKey ?? '', amount: formatIdr(i.unitPrice * i.quantity) })),
      totalLabel: t('bill.total'),
      total: formatIdr(bill.totals.gross),
      dueTitle: t('bill.dueTitle'),
      rows,
      roundingLine: roundingLine(bill, t),
      payment: payLines.length > 0 || pay.qrisImageUrl ? { title: t('bill.transferTo'), lines: payLines, qrisUrl: pay.qrisImageUrl, qrisCaption: t('bill.qrisCaption') } : null,
      brand: t('common.appName'),
      madeWith: t('board.captions.madeWith'),
    },
  };
}

export function billFilename(session: SessionDoc): string {
  return `frdup-tagihan-${session.sportId}-${toIsoDate(session.playedAt)}.png`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older WebViews / insecure contexts: fall back to a hidden textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** WhatsApp deep link; the Web Share API (text) is the fallback when the popup is blocked. */
export async function openWhatsapp(text: string): Promise<'whatsapp' | 'shared' | 'failed'> {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const win = window.open(url, '_blank', 'noopener');
  if (win) return 'whatsapp';
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch {
      return 'failed';
    }
  }
  window.location.href = url;
  return 'whatsapp';
}
