import { useMemo, useState } from 'react';
import { Check, ChevronDown, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/components/cn';
import { CourtSheets, type CourtSheetState } from '@/features/session/CourtSheets';
import { teamLabel } from '@/features/shared/people';
import { useParticipantMap } from '@/features/session/selectors';
import { useSessionStore } from '@/state/sessionStore';
import type { RoundDoc } from '@/types/round';

function RoundItem({ round, open, onToggle, onEdit, canEdit }: { round: RoundDoc; open: boolean; onToggle: () => void; onEdit: (matchId: string) => void; canEdit: boolean }) {
  const { t } = useTranslation();
  const courts = useSessionStore((s) => s.session?.courts);
  const byId = useParticipantMap();
  const label = (courtId: string) => courts?.find((c) => c.id === courtId)?.label ?? '';
  const summary = round.matches.map((m) => `${m.score.points.join('–')}`).join('  ·  ');
  const panelId = `round-${round.id}`;

  return (
    <li className="overflow-hidden rounded-lg border border-line bg-surface">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className="pressable flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[17px] font-bold">
            {t('session.rounds.round', { number: round.roundNumber })}
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', round.status === 'completed' ? 'border-success text-success' : round.status === 'in_progress' ? 'border-primary text-primary' : 'border-line text-ink-muted')}>
              {round.status === 'completed' ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}
              {t(`session.rounds.${round.status === 'in_progress' ? 'inProgress' : round.status}`)}
            </span>
          </p>
          <p className="num truncate text-[13px] text-ink-muted">{summary}</p>
        </div>
        <ChevronDown size={20} className={cn('shrink-0 text-ink-faint transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open ? (
        <div id={panelId} className="flex flex-col gap-3 border-t border-line px-4 py-3">
          <ul className="flex flex-col gap-2">
            {round.matches.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
                    {label(m.courtId)}
                    {m.status === 'voided' ? ` · ${t('session.court.status.voided')}` : ''}
                  </p>
                  <p className="truncate text-[14px]">{m.teams.map((ids) => teamLabel(ids, byId, ' & ')).join('  vs  ')}</p>
                </div>
                <p className="num text-[20px] font-bold">{m.score.points.join(' : ')}</p>
                {canEdit ? (
                  <button type="button" onClick={() => onEdit(m.id)} aria-label={t('session.court.editScore')} className="pressable grid size-11 place-items-center rounded-full text-ink-muted">
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {round.restingPlayerIds.length > 0 ? (
            <p className="text-[13px] text-ink-muted">
              {t('session.court.resting')}: {teamLabel(round.restingPlayerIds, byId, ', ')}
            </p>
          ) : null}
          {round.status === 'completed' && canEdit ? <p className="text-[12px] text-ink-faint">{t('session.rounds.editScoreNotice')}</p> : null}
          {import.meta.env.DEV ? <p className="num text-[11px] text-ink-faint">{t('session.rounds.seed', { seed: round.seed, revision: round.revision })}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

export function RoundsScreen() {
  const { t } = useTranslation();
  const rounds = useSessionStore((s) => s.rounds);
  const role = useSessionStore((s) => s.role);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<CourtSheetState>(null);

  const sorted = useMemo(() => [...rounds].sort((a, b) => b.roundNumber - a.roundNumber), [rounds]);
  const effectiveOpen = openId ?? sorted[0]?.id ?? null;

  if (rounds.length === 0) return <EmptyState art="court" title={t('session.rounds.empty')} />;

  return (
    <div className="px-4 pt-4">
      <ul className="flex flex-col gap-2">
        {sorted.map((r) => (
          <RoundItem key={r.id} round={r} open={effectiveOpen === r.id} onToggle={() => setOpenId(effectiveOpen === r.id ? '' : r.id)} onEdit={(matchId) => setSheet({ kind: 'score', roundId: r.id, matchId })} canEdit={role === 'host'} />
        ))}
      </ul>
      <CourtSheets state={sheet} onClose={() => setSheet(null)} onSwitch={setSheet} />
    </div>
  );
}
