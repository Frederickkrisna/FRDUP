import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Flag, Shuffle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { haptic } from '@/components/haptics';
import { toast } from '@/components/toast/toastStore';
import { allMatchesSettled } from '@/core/session/sessionEngine';
import { CourtCard } from '@/features/session/CourtCard';
import { CourtSheets, type CourtSheetState } from '@/features/session/CourtSheets';
import { RestingBench } from '@/features/session/RestingBench';
import { useCurrentRound } from '@/features/session/selectors';
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
  const round = useCurrentRound();
  const generateNextRound = useSessionStore((s) => s.generateNextRound);
  const reshuffle = useSessionStore((s) => s.reshuffleCurrentRound);
  const notices = useSessionStore((s) => s.notices);
  const dismissNotice = useSessionStore((s) => s.dismissNotice);
  const [sheet, setSheet] = useState<CourtSheetState>(null);

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

  if (!session || !round) return null;

  const settled = allMatchesSettled(round);
  const reachedTarget = session.targetRounds !== null && round.roundNumber >= session.targetRounds;
  const untouched = round.matches.every((m) => m.status === 'scheduled');
  const activeCourts = session.courts.filter((c) => c.isActive && round.matches.some((m) => m.courtId === c.id));

  const next = () => {
    const res = generateNextRound();
    if (res.ok) {
      haptic('medium');
      window.scrollTo({ top: 0 });
      return;
    }
    haptic('warning');
    toast.warning(t(`session.court.nextError.${res.error}`));
  };

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      {role === 'cohost' ? <CoHostClaims /> : null}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[20px] font-extrabold">{t('session.court.ronde', { number: round.roundNumber })}</h2>
          {session.targetRounds !== null ? (
            <span className="num text-[13px] text-ink-muted">/{session.targetRounds}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {role === 'host' && untouched ? (
            <Button size="sm" variant="ghost" leftIcon={<Shuffle size={16} aria-hidden="true" />} onClick={() => reshuffle()}>
              {t('session.court.reshuffle')}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => void navigate(`/session/${session.id}/standings`)}>
            {t('session.court.standings')}
          </Button>
        </div>
      </div>

      <div key={round.id} className="flex flex-col gap-3">
        {activeCourts.map((court, i) => (
          <CourtCard key={court.id} court={court} index={i} locked={role === 'cohost' && !claimed.includes(court.id)} onOpenScore={openScore} onOpenMenu={openMenu} onLongPressPlayer={longPress} />
        ))}
      </div>

      <RestingBench ids={round.restingPlayerIds} />

      {role === 'host' ? (
        <div className="fixed inset-x-0 z-20 mx-auto max-w-[560px] px-4" style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 12px)' }}>
          {settled && reachedTarget ? (
            <Button size="lg" fullWidth leftIcon={<Flag size={18} aria-hidden="true" />} onClick={() => void navigate(`/session/${session.id}/finish`)}>
              {t('session.court.finishSession')}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="lg" className="flex-1" disabled={!settled} onClick={next} leftIcon={<ArrowRight size={18} aria-hidden="true" />}>
                {settled ? t('session.court.nextRound') : t('session.court.allMatchesMustComplete')}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                leftIcon={<Flag size={18} aria-hidden="true" />}
                onClick={() => void navigate(`/session/${session.id}/finish`)}
                title={t('session.court.finishTitle')}
              >
                {t('session.court.finish')}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      <CourtSheets state={sheet} onClose={() => setSheet(null)} onSwitch={setSheet} />
    </div>
  );
}
