import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CornerUpLeft, Flag, History, Shuffle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { cn } from '@/components/cn';
import { haptic } from '@/components/haptics';
import { toast } from '@/components/toast/toastStore';
import { allMatchesSettled, courtsForRound, isMatchSettled } from '@/core/session/sessionEngine';
import { CourtCard } from '@/features/session/CourtCard';
import { CourtSheets, type CourtSheetState } from '@/features/session/CourtSheets';
import { RestingBench } from '@/features/session/RestingBench';
import { RoundStrip } from '@/features/session/RoundStrip';
import { sessionRepo } from '@/data/sessionRepo';
import { useBootStore } from '@/state/bootStore';
import { useSessionStore } from '@/state/sessionStore';

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
  const reshuffle = useSessionStore((s) => s.reshuffleCurrentRound);
  const notices = useSessionStore((s) => s.notices);
  const dismissNotice = useSessionStore((s) => s.dismissNotice);
  const [sheet, setSheet] = useState<CourtSheetState>(null);
  /** An earlier round opened for correction; null follows the live round. */
  const [viewId, setViewId] = useState<string | null>(null);

  const openScore = useCallback((roundId: string, matchId: string) => setSheet({ kind: 'score', roundId, matchId }), []);
  const openMenu = useCallback((roundId: string, matchId: string) => setSheet({ kind: 'menu', roundId, matchId }), []);
  const longPress = useCallback((roundId: string, playerId: string) => setSheet({ kind: 'swap', roundId, playerId }), []);

  // Surface co-host merge notices as quiet toasts, once each.
  useEffect(() => {
    for (const n of notices) {
      toast.info(t('session.court.scoreUpdatedByCohost', { court: n.courtLabel, device: t('cohost.otherDevice') }));
      dismissNotice(n.id);
    }
  }, [notices, dismissNotice, t]);

  const sorted = useMemo(() => [...rounds].sort((a, b) => a.roundNumber - b.roundNumber), [rounds]);
  const live = sorted.at(-1);
  if (!session || !live) return null;

  const round = sorted.find((r) => r.id === viewId) ?? live;
  const viewingPast = round.id !== live.id;
  const liveSettled = allMatchesSettled(live);
  const reachedTarget = session.targetRounds !== null && live.roundNumber >= session.targetRounds;
  const untouched = round.matches.every((m) => m.status === 'scheduled');
  const done = round.matches.filter(isMatchSettled).length;
  // Courts with a match this round, including one switched off mid-round (its match must still settle).
  const roundCourts = courtsForRound(session, round);

  const show = (roundId: string | null) => {
    setViewId(roundId);
    window.scrollTo({ top: 0 });
  };

  const next = () => {
    const res = generateNextRound();
    if (res.ok) {
      haptic('medium');
      show(null);
      return;
    }
    haptic('warning');
    toast.warning(t(`session.court.nextError.${res.error}`));
  };

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      {role === 'cohost' ? <CoHostClaims /> : null}

      {sorted.length > 1 ? <RoundStrip rounds={sorted} shownId={round.id} liveId={live.id} onSelect={(id) => show(id === live.id ? null : id)} /> : null}

      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <h2 className="text-[22px] font-extrabold leading-none">{t('session.court.ronde', { number: round.roundNumber })}</h2>
          {session.targetRounds !== null ? <span className="num text-[14px] text-ink-muted">/{session.targetRounds}</span> : null}
        </div>
        {role === 'host' && !viewingPast && untouched ? (
          <Button size="sm" variant="ghost" leftIcon={<Shuffle size={16} aria-hidden="true" />} onClick={() => reshuffle()}>
            {t('session.court.reshuffle')}
          </Button>
        ) : (
          <p className="text-[13px] font-semibold text-ink-muted">{t('session.court.progress', { done, total: round.matches.length })}</p>
        )}
      </div>

      {viewingPast ? (
        <p role="status" className="flex items-start gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-[13px] text-ink-muted">
          <History size={16} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
          {t('session.court.pastRoundNote')}
        </p>
      ) : null}

      <div key={round.id} className="flex flex-col gap-3">
        {roundCourts.map((court, i) => (
          <CourtCard
            key={court.id}
            court={court}
            roundId={round.id}
            index={i}
            retiring={!viewingPast && !court.isActive}
            locked={role === 'cohost' && !claimed.includes(court.id)}
            onOpenScore={openScore}
            onOpenMenu={openMenu}
            onLongPressPlayer={longPress}
          />
        ))}
      </div>

      <RestingBench ids={round.restingPlayerIds} onPick={role === 'host' && !viewingPast && !liveSettled ? (playerId) => setSheet({ kind: 'swap', roundId: round.id, playerId }) : undefined} />

      {role === 'host' ? (
        // The fade keeps cards from showing through the bar; only the buttons take taps.
        <div className="pointer-events-none fixed inset-x-0 z-20 bg-linear-to-t from-bg from-70% to-transparent pb-3 pt-6" style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom))' }}>
          <div className="pointer-events-auto mx-auto flex max-w-[560px] gap-2 px-4">
            {viewingPast ? (
              <Button size="lg" fullWidth variant="secondary" leftIcon={<CornerUpLeft size={18} aria-hidden="true" />} onClick={() => show(null)}>
                {t('session.court.backToLive', { number: live.roundNumber })}
              </Button>
            ) : liveSettled && reachedTarget ? (
              <Button size="lg" fullWidth leftIcon={<Flag size={18} aria-hidden="true" />} onClick={() => void navigate(`/session/${session.id}/finish`)}>
                {t('session.court.finishSession')}
              </Button>
            ) : (
              <>
                {/* Not natively disabled: a tap while matches are open says why (next() toasts the reason). */}
                <Button size="lg" className={cn('min-w-0 flex-1', !liveSettled && 'opacity-45')} aria-disabled={!liveSettled} onClick={next} leftIcon={<ArrowRight size={18} aria-hidden="true" />}>
                  {t('session.court.nextRound')}
                </Button>
                <Button size="lg" variant="secondary" className="shrink-0" leftIcon={<Flag size={18} aria-hidden="true" />} onClick={() => void navigate(`/session/${session.id}/finish`)} title={t('session.court.finishTitle')}>
                  {t('session.court.finish')}
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <CourtSheets state={sheet} onClose={() => setSheet(null)} onSwitch={setSheet} />
    </div>
  );
}
