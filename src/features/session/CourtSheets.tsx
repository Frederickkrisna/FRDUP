import { useMemo } from 'react';
import { Ban, Check, RotateCcw, Shuffle, Undo2, UserRoundCog, UserRoundPen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { ScorePadHost } from '@/components/score/ScorePadHost';
import type { PadLabels, ScoreChange } from '@/components/score/types';
import { haptic } from '@/components/haptics';
import { toast } from '@/components/toast/toastStore';
import { completionBlocker } from '@/core/session/sessionEngine';
import { getSportPlugin } from '@/core/sports/registry';
import { initialsOf } from '@/core/utils/avatar';
import { displayName, participantFromPlayer, teamLabel } from '@/features/shared/people';
import { useRosterStore } from '@/state/rosterStore';
import { useSessionStore } from '@/state/sessionStore';
import type { Id } from '@/types/common';
import { useParticipantMap } from './selectors';

export type CourtSheetState =
  | { kind: 'score'; roundId: Id; matchId: Id }
  | { kind: 'menu'; roundId: Id; matchId: Id }
  | { kind: 'swap'; roundId: Id; playerId: Id }
  | { kind: 'substitute'; roundId: Id; playerId: Id }
  /** Step 1 of swap/substitute from the match menu: WHICH player on this court? */
  | { kind: 'pick'; roundId: Id; matchId: Id; then: 'swap' | 'substitute' }
  | null;

type SheetProps = { onClose: () => void; onSwitch: (next: CourtSheetState) => void };

/* ------------------------------------------------------------------ score pad sheet */

function useMatch(roundId: Id, matchId: Id) {
  return useSessionStore((s) => s.rounds.find((r) => r.id === roundId)?.matches.find((m) => m.id === matchId) ?? null);
}

export function ScoreSheet({ roundId, matchId, onClose }: { roundId: Id; matchId: Id; onClose: () => void }) {
  const { t } = useTranslation();
  const match = useMatch(roundId, matchId);
  const session = useSessionStore((s) => s.session);
  const setScore = useSessionStore((s) => s.setScore);
  const completeMatch = useSessionStore((s) => s.completeMatch);
  const undoLast = useSessionStore((s) => s.undoLast);
  const canUndo = useSessionStore((s) => s.undo.length > 0);
  const byId = useParticipantMap();

  const view = useMemo(() => {
    if (!match || !session) return null;
    const plugin = getSportPlugin(session.sportId);
    const spec = session.scoreInput;
    const teamNames = match.teams.map((ids) => teamLabel(ids, byId, ' & '));
    const validation = plugin.validate(match.score, spec);
    const blocker = completionBlocker(match, plugin, spec);
    const rule =
      spec.type === 'race_to_n'
        ? spec.hardCap
          ? t('session.court.ruleCap', { target: spec.targetScore ?? 21, cap: spec.hardCap })
          : t('session.court.ruleNoCap', { target: spec.targetScore ?? 21 })
        : '';
    const labels: PadLabels = {
      increase: (team, value) => t('session.court.increase', { team, value }),
      decrease: (team, value) => t('session.court.decrease', { team, value }),
      total: t('session.court.padTotal', { total: spec.fixedTotal ?? 0 }),
      deuce: t('session.court.deuce'),
      rule,
      pickFor: (team) => t('session.court.pickFor', { team }),
      setScore: (team, value) => t('session.court.setScore', { team, value }),
    };
    return { plugin, spec, teamNames, validation, blocker, labels };
  }, [match, session, byId, t]);

  if (!match || !view || !session) return null;
  const settled = match.status === 'completed' || match.status === 'voided';

  const onChange = (c: ScoreChange) => setScore(roundId, matchId, c);

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('session.court.editScore')}
      closeLabel={t('common.close')}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" disabled={!canUndo} leftIcon={<Undo2 size={18} aria-hidden="true" />} onClick={() => undoLast()} aria-label={t('common.undo')}>
            {t('common.undo')}
          </Button>
          {match.status === 'completed' ? (
            <Button size="lg" fullWidth variant="secondary" onClick={onClose}>
              {t('common.done')}
            </Button>
          ) : (
            <Button
              size="lg"
              fullWidth
              disabled={view.blocker !== null}
              leftIcon={<Check size={18} strokeWidth={3} aria-hidden="true" />}
              onClick={() => {
                completeMatch(roundId, matchId);
                haptic('success');
                onClose();
              }}
            >
              {t('session.court.completeMatch')}
            </Button>
          )}
        </div>
      }
    >
      <div className="pb-4 pt-2">
        <ScorePadHost spec={view.spec} points={match.score.points} teamNames={view.teamNames} winnerTeamIndex={match.score.winnerTeamIndex} disabled={settled} labels={view.labels} onChange={onChange} />
        {!view.validation.ok ? (
          <ul role="alert" className="mt-4 flex flex-col gap-1">
            {view.validation.errors.map((e) => (
              <li key={e.key} className="text-center text-[13px] text-danger">
                {t(e.key, e.params)}
              </li>
            ))}
          </ul>
        ) : view.blocker && match.status === 'in_progress' ? (
          <p className="mt-4 text-center text-[13px] text-ink-faint">{t(view.blocker)}</p>
        ) : null}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------------- menu sheet */

export function MenuSheet({ roundId, matchId, onClose, onSwitch }: SheetProps & { roundId: Id; matchId: Id }) {
  const { t } = useTranslation();
  const match = useMatch(roundId, matchId);
  const resetMatch = useSessionStore((s) => s.resetMatch);
  const voidMatch = useSessionStore((s) => s.voidMatch);
  const undoLast = useSessionStore((s) => s.undoLast);
  const byId = useParticipantMap();
  if (!match) return null;
  const settled = match.status === 'completed' || match.status === 'voided';
  const hasPlayers = match.teams.some((team) => team.length > 0);

  const row = 'pressable flex min-h-14 w-full items-center gap-3 rounded-md border border-line bg-surface-2 px-4 text-left text-[16px] font-semibold disabled:opacity-40';

  return (
    <Sheet open onClose={onClose} title={t('session.court.menuTitle')} closeLabel={t('common.close')}>
      <div className="flex flex-col gap-2 pb-4">
        <button type="button" className={row} onClick={() => onSwitch({ kind: 'score', roundId, matchId })}>
          <Check size={20} aria-hidden="true" />
          {t('session.court.editScore')}
        </button>
        <button type="button" className={row} disabled={!hasPlayers || settled} onClick={() => onSwitch({ kind: 'pick', roundId, matchId, then: 'swap' })}>
          <Shuffle size={20} aria-hidden="true" />
          {t('session.court.swapPlayers')}
        </button>
        <button type="button" className={row} disabled={!hasPlayers || settled} onClick={() => onSwitch({ kind: 'pick', roundId, matchId, then: 'substitute' })}>
          <UserRoundPen size={20} aria-hidden="true" />
          {t('session.court.substitute')}
        </button>
        <button
          type="button"
          className={row}
          disabled={match.status === 'scheduled'}
          onClick={() => {
            resetMatch(roundId, matchId);
            toast.undo(t('session.court.resetToast'), t('common.undo'), () => undoLast());
            onClose();
          }}
        >
          <RotateCcw size={20} aria-hidden="true" />
          {t('session.court.resetScore')}
        </button>
        <button
          type="button"
          className={`${row} text-danger`}
          disabled={match.status === 'voided'}
          onClick={() => {
            voidMatch(roundId, matchId);
            haptic('heavy');
            toast.undo(t('session.court.voidToast'), t('common.undo'), () => undoLast());
            onClose();
          }}
        >
          <Ban size={20} aria-hidden="true" />
          {t('session.court.voidMatch')}
        </button>
        <p className="mt-2 text-[12px] text-ink-faint">{teamLabel(match.teams.flat(), byId, ' · ')}</p>
      </div>
    </Sheet>
  );
}

/* --------------------------------------------------------------------------- pick sheet */

function PlayerButton({ id, onClick, disabled }: { id: Id; onClick: () => void; disabled?: boolean }) {
  const byId = useParticipantMap();
  const p = byId.get(id);
  if (!p) return null;
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="pressable flex min-h-14 w-full items-center gap-3 rounded-md border border-line bg-surface-2 px-3 text-left disabled:opacity-40">
      <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} src={p.avatarUrl} size="sm" />
      <span className="truncate text-[16px] font-semibold">{displayName(p)}</span>
    </button>
  );
}

/** "Who is stepping out?": one tap per player on this court, then the swap/substitute sheet. */
export function PickPlayerSheet({ roundId, matchId, then, onClose, onSwitch }: SheetProps & { roundId: Id; matchId: Id; then: 'swap' | 'substitute' }) {
  const { t } = useTranslation();
  const match = useMatch(roundId, matchId);
  if (!match) return null;
  return (
    <Sheet open onClose={onClose} title={t(then === 'swap' ? 'session.court.pickSwapTitle' : 'session.court.pickSubTitle')} closeLabel={t('common.close')}>
      <div className="flex flex-col gap-4 pb-4">
        {match.teams.map((ids, i) => (
          <section key={i} aria-label={t('session.court.teamN', { n: i + 1 })}>
            <h3 className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">{t('session.court.teamN', { n: i + 1 })}</h3>
            <ul className="flex flex-col gap-1.5">
              {ids.map((id) => (
                <li key={id}>
                  <PlayerButton id={id} onClick={() => onSwitch({ kind: then, roundId, playerId: id })} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

/* --------------------------------------------------------------------------- swap sheet */

/**
 * Swap two players in the current round. Resting players come first: "X has to step away, Y plays
 * now". The one who went to the bench rested this round, so the next round plays them first
 * (rest queue: never benched twice in a row).
 */
export function SwapSheet({ roundId, playerId, onClose }: { roundId: Id; playerId: Id; onClose: () => void }) {
  const { t } = useTranslation();
  const round = useSessionStore((s) => s.rounds.find((r) => r.id === roundId));
  const courts = useSessionStore((s) => s.session?.courts);
  const swap = useSessionStore((s) => s.swapPlayers);
  const byId = useParticipantMap();
  if (!round) return null;
  const self = byId.get(playerId);
  const selfName = self ? displayName(self) : '';
  const selfResting = round.restingPlayerIds.includes(playerId);
  const ownMatch = round.matches.find((m) => m.teams.some((team) => team.includes(playerId)));
  const ownSettled = ownMatch ? ownMatch.status === 'completed' || ownMatch.status === 'voided' : false;

  const bench = { key: 'bench', title: t('session.court.benchPlaysNow'), ids: round.restingPlayerIds.filter((id) => id !== playerId), locked: false };
  const courtGroups = round.matches.map((m) => ({
    key: m.id,
    title: courts?.find((c) => c.id === m.courtId)?.label ?? '',
    // Same match: only the other team (swapping teammates changes nothing).
    ids: m.teams.filter((team) => !team.includes(playerId)).flat(),
    locked: m.status === 'completed' || m.status === 'voided',
  }));
  const groups = (selfResting ? courtGroups : [bench, ...courtGroups]).filter((g) => g.ids.length > 0);

  const pick = (otherId: Id, fromBench: boolean) => {
    const other = byId.get(otherId);
    const otherName = other ? displayName(other) : '';
    swap(roundId, playerId, otherId);
    haptic('medium');
    if (selfResting) toast.success(t('session.court.benchSwapDone', { inn: selfName, out: otherName }));
    else if (fromBench) toast.success(t('session.court.benchSwapDone', { inn: otherName, out: selfName }));
    else toast.success(t('session.court.swapDone', { a: selfName, b: otherName }));
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={selfResting ? t('session.court.playInsteadOf', { name: selfName }) : t('session.court.swapWith', { name: selfName })} closeLabel={t('common.close')}>
      <div className="flex flex-col gap-4 pb-4">
        {!selfResting && bench.ids.length === 0 ? <p className="rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink-muted">{t('session.court.noBenchHint')}</p> : null}
        {groups.map((g) => (
          <section key={g.key} aria-label={g.title}>
            <h3 className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">{g.title}</h3>
            <ul className="flex flex-col gap-1.5">
              {g.ids.map((id) => (
                <li key={id}>
                  <PlayerButton id={id} disabled={g.locked || ownSettled} onClick={() => pick(id, g.key === 'bench')} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------------- substitute sheet */

export function SubstituteSheet({ roundId, playerId, onClose }: { roundId: Id; playerId: Id; onClose: () => void }) {
  const { t } = useTranslation();
  const round = useSessionStore((s) => s.rounds.find((r) => r.id === roundId));
  const roster = useRosterStore((s) => s.players);
  const substitute = useSessionStore((s) => s.substitute);
  const addParticipant = useSessionStore((s) => s.addParticipant);
  const byId = useParticipantMap();
  if (!round) return null;
  const self = byId.get(playerId);
  const onCourt = new Set(round.matches.flatMap((m) => m.teams.flat()));

  // Anyone not currently on a court: resting participants first, then the rest of the roster.
  const resting = round.restingPlayerIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
  const outsiders = roster.filter((p) => p.archivedAt === null && !byId.has(p.id) && !onCourt.has(p.id));

  const pick = (inId: Id, add?: ReturnType<typeof participantFromPlayer>) => {
    if (add) addParticipant(add);
    substitute(playerId, inId);
    haptic('medium');
    toast.success(t('session.court.substituteDone', { out: self ? displayName(self) : '', inn: add ? displayName(add) : displayName(byId.get(inId) ?? { name: '?', nickname: null }) }));
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={t('session.court.substituteFor', { name: self ? displayName(self) : '' })} closeLabel={t('common.close')}>
      <div className="flex flex-col gap-4 pb-4">
        {resting.length > 0 ? (
          <section>
            <h3 className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">{t('session.court.resting')}</h3>
            <ul className="flex flex-col gap-1.5">
              {resting.map((p) => (
                <li key={p.playerId}>
                  <button type="button" className="pressable flex min-h-14 w-full items-center gap-3 rounded-md border border-line bg-surface-2 px-3 text-left" onClick={() => pick(p.playerId)}>
                    <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} size="sm" />
                    <span className="truncate text-[16px] font-semibold">{displayName(p)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <h3 className="mb-1.5 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
            <UserRoundCog size={14} aria-hidden="true" />
            {t('session.court.lateArrivals')}
          </h3>
          {outsiders.length === 0 ? (
            <p className="text-[14px] text-ink-faint">{t('session.court.noOutsiders')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {outsiders.map((p) => (
                <li key={p.id}>
                  <button type="button" className="pressable flex min-h-14 w-full items-center gap-3 rounded-md border border-line bg-surface-2 px-3 text-left" onClick={() => pick(p.id, participantFromPlayer(p))}>
                    <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} size="sm" />
                    <span className="truncate text-[16px] font-semibold">{displayName(p)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}

/** Mounts whichever sheet the courts/rounds screen asked for. */
export function CourtSheets({ state, onClose, onSwitch }: { state: CourtSheetState } & SheetProps) {
  if (!state) return null;
  switch (state.kind) {
    case 'score':
      return <ScoreSheet roundId={state.roundId} matchId={state.matchId} onClose={onClose} />;
    case 'menu':
      return <MenuSheet roundId={state.roundId} matchId={state.matchId} onClose={onClose} onSwitch={onSwitch} />;
    case 'swap':
      return <SwapSheet roundId={state.roundId} playerId={state.playerId} onClose={onClose} />;
    case 'substitute':
      return <SubstituteSheet roundId={state.roundId} playerId={state.playerId} onClose={onClose} />;
    case 'pick':
      return <PickPlayerSheet roundId={state.roundId} matchId={state.matchId} then={state.then} onClose={onClose} onSwitch={onSwitch} />;
  }
}
