import { memo, useCallback, useRef } from 'react';
import { Check, Ellipsis, Minus, Plus, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { ScoreDigits } from '@/components/score/ScoreDigits';
import { haptic } from '@/components/haptics';
import { cn } from '@/components/cn';
import { toast } from '@/components/toast/toastStore';
import { getSportPlugin } from '@/core/sports/registry';
import { completionBlocker } from '@/core/session/sessionEngine';
import { initialsOf } from '@/core/utils/avatar';
import { displayName } from '@/features/shared/people';
import { sportAccent } from '@/features/shared/sportMeta';
import { useSessionStore } from '@/state/sessionStore';
import type { CourtDef } from '@/types/session';
import { useCourtMatch, useParticipantMap } from './selectors';

type Props = {
  court: CourtDef;
  /** The live round, or an earlier one opened for correction. */
  roundId: string;
  /** Co-host viewing a court they have not claimed. */
  locked: boolean;
  onOpenScore: (roundId: string, matchId: string) => void;
  onOpenMenu: (roundId: string, matchId: string) => void;
  onLongPressPlayer: (roundId: string, playerId: string) => void;
  index: number;
  /** Switched off mid-round: this match still has to be finished or voided, then the court is gone. */
  retiring?: boolean;
};

const LONG_PRESS_MS = 450;

/**
 * One court, laid out like a scoreboard: teams face each other across a centre line. Subscribes to
 * its OWN match only (see selectors.useCourtMatch), so scoring on court 1 never re-renders court 2.
 * 64px increment targets while the match is open; a settled match folds down to its result.
 */
export const CourtCard = memo(function CourtCard({ court, roundId, locked, onOpenScore, onOpenMenu, onLongPressPlayer, index, retiring = false }: Props) {
  const { t } = useTranslation();
  const match = useCourtMatch(roundId, court.id);
  const byId = useParticipantMap();
  const sportId = useSessionStore((s) => s.session?.sportId);
  const spec = useSessionStore((s) => s.session?.scoreInput);
  const setScore = useSessionStore((s) => s.setScore);
  const completeMatch = useSessionStore((s) => s.completeMatch);
  const reopenMatch = useSessionStore((s) => s.reopenMatch);
  const undoLast = useSessionStore((s) => s.undoLast);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const startPress = useCallback(
    (playerId: string) => {
      cancelPress();
      pressTimer.current = setTimeout(() => {
        haptic('medium');
        onLongPressPlayer(roundId, playerId);
      }, LONG_PRESS_MS);
    },
    [onLongPressPlayer, roundId],
  );

  if (!match || !sportId || !spec) return null;
  const plugin = getSportPlugin(sportId);
  const step = spec.step ?? 1;
  const teams = match.teams;
  const wide = teams.length > 2;
  const settled = match.status === 'completed' || match.status === 'voided';
  const blocker = completionBlocker(match, plugin, spec);
  const winner = match.score.winnerTeamIndex;

  const bump = (teamIndex: number, dir: 1 | -1) => {
    haptic('tap');
    setScore(roundId, match.id, { teamIndex, value: dir * step, mode: 'delta' });
  };

  const finish = () => {
    completeMatch(roundId, match.id);
    haptic('success');
    toast.undo(t('session.court.undoScore'), t('common.undo'), () => undoLast());
  };

  const statusLabel =
    match.status === 'completed' ? t('session.court.status.completed') : match.status === 'voided' ? t('session.court.status.voided') : match.status === 'in_progress' ? t('session.court.status.inProgress') : t('session.court.status.scheduled');

  const pointsKey = match.score.points.join('-');
  const scoreSummary = teams.map((_, i) => `${match.score.points[i] ?? 0}`).join(' : ');

  return (
    <article
      aria-label={`${court.label}: ${statusLabel}`}
      className={cn(
        'rise-in relative overflow-hidden rounded-lg border bg-surface-2',
        match.status === 'in_progress' ? 'border-primary' : 'border-line',
        match.status === 'voided' && 'opacity-60',
      )}
      style={{ '--i': index } as React.CSSProperties}
    >
      <span key={pointsKey} aria-hidden="true" className="flash-ring pointer-events-none absolute inset-0 rounded-lg border-2 border-primary opacity-0" />

      <header className="flex items-center justify-between gap-2 border-b border-line py-1 pl-4 pr-1.5">
        <h3 className="flex min-w-0 items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: sportAccent(sportId) }} />
          <span className="truncate">{court.label}</span>
        </h3>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold', match.status === 'in_progress' ? 'border-primary text-primary' : match.status === 'completed' ? 'border-success text-success' : 'border-line text-ink-muted')}>
            {match.status === 'in_progress' ? <span aria-hidden="true" className="pulse-dot size-1.5 rounded-full bg-primary" /> : null}
            {match.status === 'completed' ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
            {statusLabel}
          </span>
          {!locked ? (
            <button type="button" onClick={() => onOpenMenu(roundId, match.id)} aria-label={t('session.court.menu', { court: court.label })} className="pressable grid size-11 place-items-center rounded-full text-ink-muted">
              <Ellipsis size={20} aria-hidden="true" />
            </button>
          ) : (
            <span className="h-11 w-2" />
          )}
        </div>
      </header>

      {retiring ? (
        <p role="note" className="mx-4 mt-3 rounded-md border border-warning/60 px-3 py-2 text-[13px] text-warning">
          {settled ? t('session.court.retiringDone') : t('session.court.retiring')}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-y-4 px-4 py-4">
        {teams.map((ids, i) => {
          const right = i % 2 === 1;
          const points = match.score.points[i] ?? 0;
          const players = ids.map((id) => ({ id, p: byId.get(id) }));
          const teamName = players.map(({ p }) => (p ? displayName(p) : '?')).join(' & ');
          const won = settled && winner === i;
          return (
            <div key={i} className={cn('flex min-w-0 flex-col gap-2', right ? 'border-l border-line pl-3' : 'pr-3')}>
              <ul className={cn('flex min-h-[60px] flex-col justify-center gap-1', right && 'items-end')}>
                {players.map(({ id, p }) => (
                  <li
                    key={id}
                    className={cn('no-select flex max-w-full items-center gap-2', right && 'flex-row-reverse')}
                    onPointerDown={() => !locked && !settled && startPress(id)}
                    onPointerUp={cancelPress}
                    onPointerLeave={cancelPress}
                    onPointerCancel={cancelPress}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {p ? (
                      <span aria-hidden="true" className="shrink-0">
                        <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} src={p.avatarUrl} size="xs" />
                      </span>
                    ) : null}
                    <span className={cn('truncate text-[15px] font-semibold leading-tight', settled && !won && 'text-ink-muted')}>{p ? displayName(p) : '?'}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={locked}
                onClick={() => onOpenScore(roundId, match.id)}
                aria-label={t('session.court.openPad', { team: teamName, points })}
                className={cn('pressable grid w-full place-items-center rounded-md', settled ? 'min-h-12' : 'min-h-16')}
              >
                <ScoreDigits value={points} size={settled || wide ? 'lg' : 'xl'} className={won ? 'text-success' : settled ? 'text-ink-muted' : undefined} />
              </button>

              {!settled ? (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={locked || (points <= 0 && (spec.type === 'fixed_sum' || !(spec.allowNegative ?? false)))}
                    onClick={() => bump(i, -1)}
                    aria-label={t('session.court.decrease', { team: teamName, value: points - step })}
                    className="pressable hit-slop no-select relative grid size-16 place-items-center rounded-md border border-line bg-surface text-ink-muted disabled:opacity-30"
                  >
                    <Minus size={22} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={locked || (spec.type === 'fixed_sum' && points >= (spec.fixedTotal ?? 21))}
                    onClick={() => bump(i, 1)}
                    aria-label={t('session.court.increase', { team: teamName, value: points + step })}
                    className="pressable hit-slop no-select relative grid size-16 place-items-center rounded-md border border-line-strong bg-surface-3 text-ink disabled:opacity-30"
                  >
                    <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {scoreSummary}
      </p>

      {!settled && match.status === 'in_progress' && blocker === null && !locked ? (
        <div className="px-4 pb-4">
          <button type="button" onClick={finish} className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-success text-[16px] font-bold text-success-on">
            <Check size={18} strokeWidth={3} aria-hidden="true" />
            {t('session.court.completeMatch')}
          </button>
        </div>
      ) : null}
      {match.status === 'completed' && !locked ? (
        <button type="button" onClick={() => reopenMatch(roundId, match.id)} className="pressable flex min-h-11 w-full items-center justify-center gap-2 border-t border-line text-[14px] font-semibold text-ink-muted">
          <RotateCcw size={16} aria-hidden="true" />
          {t('session.court.reopenMatch')}
        </button>
      ) : null}
      {locked ? (
        <div className="absolute inset-0 grid place-items-center rounded-lg bg-bg/70 backdrop-blur-[1px]">
          <span className="rounded-full border border-line-strong bg-surface-2 px-4 py-2 text-[14px] font-semibold">{t('session.court.locked')}</span>
        </div>
      ) : null}
    </article>
  );
});
