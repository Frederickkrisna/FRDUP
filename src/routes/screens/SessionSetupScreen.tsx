import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { toast } from '@/components/toast/toastStore';
import { getSportPlugin } from '@/core/sports/registry';
import { LIMITS, playersPerMatch, resolveMatchShape } from '@/core/session/sessionEngine';
import { SetupCourtsStep, defaultCourtLabel } from '@/features/session/setup/SetupCourtsStep';
import { SetupFormatStep } from '@/features/session/setup/SetupFormatStep';
import { SetupPlayersStep } from '@/features/session/setup/SetupPlayersStep';
import { participantFromPlayer, useSetupDraft } from '@/features/shared/people';
import { sportAccent } from '@/features/shared/sportMeta';
import { useHost } from '@/features/shared/useHost';
import { useAppStore } from '@/state/appStore';
import { useBootStore } from '@/state/bootStore';
import { useRosterStore } from '@/state/rosterStore';
import { useSessionStore } from '@/state/sessionStore';
import type { SessionFormat, SportId } from '@/types/sport';

type Step = 1 | 2 | 3;

export function SessionSetupScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const hostId = useAppStore((s) => s.hostId);
  const uid = useBootStore((s) => s.uid);
  const defaultSport = useAppStore((s) => s.defaultSportId);
  const lastSport = useAppStore((s) => s.lastSportId);
  const setLastSport = useAppStore((s) => s.setLastSport);
  const host = useHost(hostId);
  const players = useRosterStore((s) => s.players);
  const draft = useSetupDraft();
  const startSession = useSessionStore((s) => s.startSession);
  const hasLive = useSessionStore((s) => s.session !== null && (s.session.status === 'live' || s.session.status === 'paused'));
  const [starting, setStarting] = useState(false);

  const [step, setStep] = useState<Step>(() => (Number(params.get('step')) || 1) as Step);
  const sportId: SportId = (draft.sportId as SportId | null) ?? lastSport ?? defaultSport ?? 'badminton';

  // Preselect the sport once so every step agrees on it.
  useEffect(() => {
    if (draft.sportId === null) draft.patch({ sportId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
  }, []);

  const plugin = getSportPlugin(sportId);
  const config = useMemo(() => {
    const defaults = Object.fromEntries(plugin.settings.map((s) => [s.key, s.default]));
    return { ...defaults, ...(host?.sportDefaults[sportId] ?? {}), ...draft.config };
  }, [plugin, host, sportId, draft.config]);
  const shape = resolveMatchShape(plugin, config);
  const minPlayers = playersPerMatch(shape);

  const selected = players.filter((p) => draft.playerIds.includes(p.id));
  const canNext = step === 1 ? selected.length >= minPlayers : true;

  const go = (s: Step) => {
    setStep(s);
    setParams({ step: String(s) }, { replace: true });
  };

  const start = () => {
    if (!hostId || !uid) return;
    const courtCount = draft.courtCount ?? plugin.defaultCourtCount;
    const noun = t(plugin.courtLabelKey);
    const format = (draft.format === 'mexicano' ? 'mexicano' : 'americano') as SessionFormat;
    setStarting(true);
    const result = startSession({
      hostId,
      hostAnonUid: uid,
      sportId,
      format,
      title: draft.title.trim() || null,
      venue: draft.venue.trim() || null,
      courts: Array.from({ length: courtCount }, (_, i) => ({ label: (draft.courtLabels[i] ?? defaultCourtLabel(noun, i)).trim() || defaultCourtLabel(noun, i) })),
      targetRounds: draft.targetRounds,
      sportConfig: config,
      scoreInput: plugin.buildScoreInput(config),
      participants: selected.map(participantFromPlayer),
    });
    setStarting(false);
    if (!result.ok) {
      toast.danger(result.error === 'limit' ? t('session.setup.limitReached') : t('session.setup.notEnoughPlayers', { min: minPlayers }));
      return;
    }
    setLastSport(sportId);
    draft.reset();
    void navigate(`/session/${result.sessionId}/courts`, { replace: true });
  };

  const titles: Record<Step, string> = { 1: t('session.setup.stepSport'), 2: t('session.setup.stepCourts'), 3: t('session.setup.stepFormat') };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      <ScreenHeader
        title={t('session.setup.title')}
        subtitle={`${step}/3 · ${titles[step]}`}
        accent={sportAccent(sportId)}
        onBack={() => (step > 1 ? go((step - 1) as Step) : void navigate('/home'))}
        backLabel={t('common.back')}
      />
      <div className="flex gap-1.5 px-4 pt-3" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1 flex-1 rounded-full transition-colors duration-200 ${n <= step ? 'bg-primary' : 'bg-surface-3'}`} />
        ))}
      </div>

      {hasLive ? (
        <p role="alert" className="mx-4 mt-3 rounded-md border border-warning/60 bg-surface p-3 text-[13px] text-warning">
          {t('session.setup.liveExists')}
        </p>
      ) : null}

      <main key={step} className="rise-in flex-1 px-4 pb-32 pt-5">
        {step === 1 ? <SetupPlayersStep /> : null}
        {step === 2 ? <SetupCourtsStep plugin={plugin} playerCount={selected.length} shape={shape} /> : null}
        {step === 3 ? <SetupFormatStep plugin={plugin} config={config} /> : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[560px] items-center gap-3 px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="num text-[15px] font-semibold">{t('session.setup.playerCount', { count: selected.length })}</p>
            {selected.length < minPlayers ? <p className="text-[12px] text-warning">{t('session.setup.notEnoughPlayers', { min: minPlayers })}</p> : selected.length > LIMITS.participants ? <p className="text-[12px] text-warning">{t('session.setup.limitReached')}</p> : null}
          </div>
          {step < 3 ? (
            <Button size="lg" disabled={!canNext} onClick={() => go((step + 1) as Step)}>
              {t('common.next')}
            </Button>
          ) : (
            <Button size="lg" loading={starting} disabled={selected.length < minPlayers || selected.length > LIMITS.participants || hasLive} onClick={start}>
              {t('session.setup.cta')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
