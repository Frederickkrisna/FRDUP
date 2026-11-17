import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, CornerUpLeft, Flag, Plus, Shuffle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { cn } from '@/components/cn';
import { haptic } from '@/components/haptics';
import { toast } from '@/components/toast/toastStore';
import { allMatchesSettled, courtsForRound, isMatchSettled, isRoundUntouched, liveRound } from '@/core/session/sessionEngine';
import { CourtCard } from '@/features/session/CourtCard';
import { CourtSheets, type CourtSheetState } from '@/features/session/CourtSheets';
import { RestingBench } from '@/features/session/RestingBench';
import { RoundStrip } from '@/features/session/RoundStrip';
import { sessionRepo } from '@/data/sessionRepo';
import { useBootStore } from '@/state/bootStore';
import { selectCurrentRound, useSessionStore } from '@/state/sessionStore';

function CoHostClaims() {
  const { t } = useTranslation();
  const courts = useSessionStore((s) => s.session?.courts);
  const sessionId = useSessionStore((s) => s.session?.id);
  const claimed = useSessionStore((s) => s.claimedCourtIds);
  const claim = useSessionStore((s) => s.claimCourts);
  const uid = useBootStore((s) => s.uid);
  if (!courts || !sessionId || !uid) return null;

  const toggle = (id: string) => {
    const next = claimed.includes(id) ? claimed.filter((c) => c !== id) : [...claimed, id];
    claim(next);
    sessionRepo.claimCourts(sessionId, uid, next);
    haptic('tap');
  };

  return (
    <section aria-labelledby="claims" className="rounded-lg border border-line bg-surface p-3">
      <h2 id="claims" className="mb-2 text-[14px] font-bold">
        {t('cohost.claimTitle')}
      </h2>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby="claims">
        {courts.filter((c) => c.isActive).map((c) => (
          <Chip key={c.id} selected={claimed.includes(c.id)} onClick={() => toggle(c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-ink-faint">{t('cohost.claimHint')}</p>
    </section>
  );
}

export function CourtsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const role = useSessionStore((s) => s.role);
  const claimed = useSessionStore((s) => s.claimedCourtIds);
  const rounds = useSessionStore((s) => s.rounds);
  const generateNextRound = useSessionStore((s) => s.generateNextRound);
  const reshuffle = useSessionStore((s) => s.reshuffleRound);
  const [sheet, setSheet] = useState<CourtSheetState>(null);
  /**
   * The round on screen. Pinned at mount to the live round, so finishing its last match does not
   * yank the screen to the next round mid-tap; the bottom button moves on when the host is ready.
   */
  const [viewId, setViewId] = useState<string | null>(() => selectCurrentRound(useSessionStore.getState())?.id ?? null);

  const openScore = useCallback((roundId: string, matchId: string) => setSheet({ kind: 'score', roundId, matchId }), []);
  const openMenu = useCallback((roundId: string, matchId: string) => setSheet({ kind: 'menu', roundId, matchId }), []);
  const longPress = useCallback((roundId: string, playerId: string) => setSheet({ kind: 'swap', roundId, playerId }), []);

  const sorted = useMemo(() => [...rounds].sort((a, b) => a.roundNumber - b.roundNumber), [rounds]);
  const live = liveRound(sorted);
  if (!session || !live) return null;

  const round = sorted.find((r) => r.id === viewId) ?? live;
  const onLive = round.id === live.id;
  const settled = allMatchesSettled(round);
  const reachedTarget = session.targetRounds !== null && live.roundNumber >= session.targetRounds;
  const untouched = isRoundUntouched(round);
  const done = round.matches.filter(isMatchSettled).length;
  // Courts with a match this round, including one switched off mid-round (its match must still settle).
  const roundCourts = courtsForRound(session, round);

  const show = (roundId: string) => {
    setViewId(roundId);
    window.scrollTo({ top: 0 });
  };

  const next = () => {
    const res = generateNextRound();
    if (res.ok) {
      haptic('medium');
      const fresh = selectCurrentRound(useSessionStore.getState());
      if (fresh) show(fresh.id);
      return;
    }
    haptic('warning');
    toast.warning(t(`session.court.nextError.${res.error}`));
  };

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      {role === 'cohost' ? <CoHostClaims /> : null}

      {sorted.length > 1 ? <RoundStrip rounds={sorted} shownId={round.id} liveId={live.id} onSelect={show} /> : null}

      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <h2 className="text-[22px] font-extrabold leading-none">{t('session.court.ronde', { number: round.roundNumber })}</h2>
          {session.targetRounds !== null ? <span className="num text-[14px] text-ink-muted">/{session.targetRounds}</span> : null}
        </div>
        {role === 'host' && untouched && round.roundNumber >= live.roundNumber ? (
          <Button size="sm" variant="ghost" leftIcon={<Shuffle size={16} aria-hidden="true" />} onClick={() => reshuffle(round.id)}>
            {t('session.court.reshuffle')}
          </Button>
        ) : (
          <p className="text-[13px] font-semibold text-ink-muted">{t('session.court.progress', { done, total: round.matches.length })}</p>
        )}
      </div>

      <div key={round.id} className="flex flex-col gap-3">
        {roundCourts.map((court, i) => (
          <CourtCard
            key={court.id}
            court={court}
            roundId={round.id}
            index={i}
            retiring={round.roundNumber >= live.roundNumber && !court.isActive}
            locked={role === 'cohost' && !claimed.includes(court.id)}
            onOpenScore={openScore}
            onOpenMenu={openMenu}
            onLongPressPlayer={longPress}
          />
        ))}
      </div>

      <RestingBench ids={round.restingPlayerIds} onPick={role === 'host' && !settled ? (playerId) => setSheet({ kind: 'swap', roundId: round.id, playerId }) : undefined} />

      {role === 'host' ? (
        // The fade keeps cards from showing through the bar; only the buttons take taps.
        <div className="pointer-events-none fixed inset-x-0 z-20 bg-linear-to-t from-bg from-70% to-transparent pb-3 pt-6" style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom))' }}>
          <div className="pointer-events-auto mx-auto flex max-w-[560px] gap-2 px-4">
            {!onLive ? (
              // Any other round (corrected, peeked at, or just finished): one tap to the round being played.
              <Button size="lg" className="min-w-0 flex-1" leftIcon={round.roundNumber < live.roundNumber ? <ArrowRight size={18} aria-hidden="true" /> : <CornerUpLeft size={18} aria-hidden="true" />} onClick={() => show(live.id)}>
                {t('session.court.goToRound', { number: live.roundNumber })}
              </Button>
            ) : settled && reachedTarget ? (
              // Target played: finishing is the main action, one more round stays one tap away.
              <>
                <Button size="lg" variant="secondary" className="shrink-0" leftIcon={<Plus size={18} aria-hidden="true" />} onClick={next}>
                  {t('session.court.addRound')}
                </Button>
                <Button size="lg" className="min-w-0 flex-1" leftIcon={<Flag size={18} aria-hidden="true" />} onClick={() => void navigate(`/session/${session.id}/finish`)}>
                  {t('session.court.finishSession')}
                </Button>
              </>
            ) : (
              // Not natively disabled: a tap while matches are open says why (next() toasts the reason).
              <Button size="lg" className={cn('min-w-0 flex-1', !settled && 'opacity-45')} aria-disabled={!settled} onClick={next} leftIcon={<ArrowRight size={18} aria-hidden="true" />}>
                {t('session.court.nextRound')}
              </Button>
            )}
            {!(onLive && settled && reachedTarget) ? (
              <Button size="lg" variant="secondary" className="shrink-0" leftIcon={<Flag size={18} aria-hidden="true" />} onClick={() => void navigate(`/session/${session.id}/finish`)} title={t('session.court.finishTitle')}>
                {t('session.court.finish')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <CourtSheets state={sheet} onClose={() => setSheet(null)} onSwitch={setSheet} />
    </div>
  );
}
