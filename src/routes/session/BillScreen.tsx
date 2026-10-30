import { useEffect, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SegmentedControl } from '@/components/SegmentedControl';
import { cn } from '@/components/cn';
import { initialsOf } from '@/core/utils/avatar';
import { formatIdr } from '@/core/utils/idr';
import { BillItemSheet } from '@/features/billing/BillItemSheet';
import { BillExportButtons } from '@/features/billing/BillExportButtons';
import { roundingLine } from '@/features/billing/billExport';
import { useStandings } from '@/features/session/selectors';
import { displayName } from '@/features/shared/people';
import { useHost } from '@/features/shared/useHost';
import { useAppStore } from '@/state/appStore';
import { useSessionStore } from '@/state/sessionStore';
import type { BillItem } from '@/types/bill';

export function BillScreen() {
  const { t } = useTranslation();
  const session = useSessionStore((s) => s.session);
  const bill = useSessionStore((s) => s.bill);
  const issues = useSessionStore((s) => s.billIssues);
  const role = useSessionStore((s) => s.role);
  const ensureBill = useSessionStore((s) => s.ensureBill);
  const upsert = useSessionStore((s) => s.upsertBillItem);
  const remove = useSessionStore((s) => s.removeBillItem);
  const setMeta = useSessionStore((s) => s.setBillMeta);
  const hostId = useAppStore((s) => s.hostId);
  const host = useHost(hostId);
  const standings = useStandings();
  const [editing, setEditing] = useState<BillItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'host' && hostId && host) ensureBill({ hostId, roundingTo: host.roundingTo, hostPlayerId: null });
  }, [role, hostId, host, ensureBill]);

  if (role === 'cohost') return <EmptyState art="bill" title={t('bill.hostOnly')} body={t('bill.hostOnlyBody')} />;
  if (!session || !bill || !host) return null;

  const byId = new Map(session.participants.map((p) => [p.playerId, p]));
  const issueIds = new Set(issues.map((i) => i.itemId));

  const canExport = bill.items.length > 0 && issues.length === 0;

  return (
    <div className="flex flex-col gap-6 px-4 pb-4 pt-4">
      {/* ------------------------------------------------------------ costs */}
      <section aria-labelledby="bill-costs">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="bill-costs" className="text-[20px] font-extrabold">
            {t('bill.costs')}
          </h2>
          <Button
            size="sm"
            leftIcon={<Plus size={16} aria-hidden="true" />}
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            {t('bill.addItem')}
          </Button>
        </div>

        {bill.items.length === 0 ? (
          <EmptyState art="bill" title={t('bill.noItems')} body={t('bill.noItemsBody')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {bill.items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(it);
                    setSheetOpen(true);
                  }}
                  className={cn('pressable flex min-h-16 w-full items-center gap-3 rounded-lg border bg-surface px-4 py-3 text-left', issueIds.has(it.id) ? 'border-danger' : 'border-line')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold">{it.customLabel ?? it.labelKey}</p>
                    <p className="truncate text-[12px] text-ink-muted">
                      {t(`bill.itemKind.${it.kind}`)} · {it.kind === 'court_fee' ? t('bill.allParticipants') : t('bill.payerCount', { count: it.payerPlayerIds.length })}
                      {it.quantity > 1 ? ` · ${it.quantity}×` : ''}
                    </p>
                    {issueIds.has(it.id) ? <p role="alert" className="text-[12px] text-danger">{t('bill.error.noPayers')}</p> : null}
                  </div>
                  <span className="num text-[16px] font-bold">{formatIdr(it.unitPrice * it.quantity)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {bill.items.length > 0 ? (
          <p className="num mt-3 flex items-baseline justify-between text-[17px]">
            <span className="font-semibold">{t('bill.total')}</span>
            <span className="text-[24px] font-bold">{formatIdr(bill.totals.gross)}</span>
          </p>
        ) : null}
      </section>

      {/* -------------------------------------------------------- settlements */}
      {bill.items.length > 0 ? (
        <section aria-labelledby="bill-split">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="bill-split" className="text-[20px] font-extrabold">
              {t('bill.settlements')}
            </h2>
          </div>
          <SegmentedControl<'100' | '500' | '1000'>
            ariaLabel={t('bill.rounding.title')}
            value={String(bill.roundingTo) as '100' | '500' | '1000'}
            onChange={(v) => setMeta({ roundingTo: Number(v) })}
            options={[
              { value: '100', label: t('bill.rounding.100') },
              { value: '500', label: t('bill.rounding.500') },
              { value: '1000', label: t('bill.rounding.1000') },
            ]}
          />

          <ul className="mt-3 flex flex-col gap-1.5">
            {bill.settlements.map((s) => {
              const p = byId.get(s.playerId);
              const expanded = open === s.playerId;
              return (
                <li key={s.playerId} className="overflow-hidden rounded-lg border border-line bg-surface">
                  <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : s.playerId)} className="pressable flex min-h-14 w-full items-center gap-3 px-3 text-left">
                    {p ? <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} size="sm" /> : null}
                    <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{p ? displayName(p) : s.name}</span>
                    <span className="num text-[17px] font-bold">{formatIdr(s.rounded)}</span>
                    <ChevronDown size={16} className={cn('shrink-0 text-ink-faint transition-transform duration-200 motion-reduce:transition-none', expanded && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {expanded ? (
                    <ul className="border-t border-line px-4 py-2">
                      {s.lines.map((l, i) => (
                        <li key={`${l.itemId}-${i}`} className="num flex justify-between py-1 text-[14px] text-ink-muted">
                          <span className="truncate pr-3">{l.label}</span>
                          <span>{formatIdr(l.amount)}</span>
                        </li>
                      ))}
                      {s.roundingDelta !== 0 ? (
                        <li className="num flex justify-between py-1 text-[14px] text-ink-faint">
                          <span>{t('bill.rounding.title')}</span>
                          <span>
                            {s.roundingDelta > 0 ? '+' : '-'}
                            {formatIdr(Math.abs(s.roundingDelta))}
                          </span>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {roundingLine(bill, t) ? <p className="num mt-3 text-[14px] text-ink-muted">{roundingLine(bill, t)}</p> : null}
        </section>
      ) : null}

      {/* -------------------------------------------------------------- send */}
      {bill.items.length > 0 ? (
        <section aria-labelledby="bill-send" className="flex flex-col gap-2">
          <h2 id="bill-send" className="text-[20px] font-extrabold">
            {t('bill.export')}
          </h2>
          {!canExport ? <p className="text-[13px] text-warning">{t('bill.fixIssuesFirst')}</p> : null}
          <BillExportButtons session={session} bill={bill} host={host} standings={standings} disabled={!canExport} />
        </section>
      ) : null}

      <BillItemSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        sportId={session.sportId}
        participants={session.participants}
        item={editing}
        onSave={(item) => {
          upsert(item);
        }}
        onDelete={(id) => {
          remove(id);
        }}
      />
    </div>
  );
}
