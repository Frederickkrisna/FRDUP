import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { parseBulkNames } from '@/core/utils/avatar';
import { hostRepo, rosterRepo } from '@/data/hostRosterRepo';
import { signInWithCredentials } from '@/data/authRepo';
import { SportIcon, allSports, sportAccent } from '@/features/shared/sportMeta';
import { deviceLabel } from '@/features/shared/people';
import { useAppStore } from '@/state/appStore';
import { useBootStore } from '@/state/bootStore';
import type { SportId } from '@/types/sport';

function Wordmark() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">
        <rect x="14" y="8" width="36" height="48" fill="none" stroke="var(--c-primary)" strokeWidth="3.5" />
        <line x1="10" y1="32" x2="54" y2="32" stroke="var(--c-primary)" strokeWidth="4.5" />
        <circle cx="42" cy="14" r="4" fill="var(--c-primary)" />
      </svg>
      <span className="text-[28px] font-extrabold tracking-[0.04em]">{t('common.appName')}</span>
    </div>
  );
}

/** Three steps with persistent username/password login. */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const uid = useBootStore((s) => s.uid);
  const setHost = useAppStore((s) => s.setHost);
  const setDefaultSport = useAppStore((s) => s.setDefaultSport);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState('fred');
  const [password, setPassword] = useState('asdasd');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sport, setSport] = useState<SportId | null>(null);
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);

  const names = parseBulkNames(bulk);

  const finish = () => {
    completeOnboarding();
    void navigate('/home', { replace: true });
  };

  const submitLogin = async () => {
    const cleanUser = username.trim();
    if (!cleanUser || !password) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const authedUid = await signInWithCredentials(cleanUser, password);
      useBootStore.setState({ uid: authedUid, status: 'ready' });
      const hostDisplayName = cleanUser.toLowerCase() === 'fred' ? 'Fred' : cleanUser;
      await hostRepo.ensureHost(authedUid, hostDisplayName, deviceLabel());
      setHost(authedUid, hostDisplayName);
      setStep(2);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMsg(e?.message || t('onboarding.step1.loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  const submitPlayers = () => {
    const currentUid = useBootStore.getState().uid || uid;
    if (currentUid && names.length > 0) rosterRepo.createMany(currentUid, names.map((n) => ({ name: n })));
    finish();
  };

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5">
      <div className="flex items-center justify-between pb-6 pt-8">
        <Wordmark />
        <p className="num text-[13px] text-ink-faint" aria-label={t('onboarding.progress', { step, total: 3 })}>
          {`${step}/3`}
        </p>
      </div>

      <div key={step} className="rise-in flex flex-1 flex-col gap-5">
        {step === 1 ? (
          <form
            className="flex flex-1 flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submitLogin();
            }}
          >
            <div>
              <h1 className="text-[32px] font-extrabold leading-[1.15]">{t('onboarding.step1.loginTitle')}</h1>
              <p className="mt-2 text-[15px] text-ink-muted">
                {t('onboarding.step1.loginSubtitle')}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <TextField
                label={t('onboarding.step1.usernameLabel')}
                placeholder="fred"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                maxLength={40}
              />
              <TextField
                label={t('onboarding.step1.passwordLabel')}
                placeholder="asdasd"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                maxLength={40}
              />
              {errorMsg ? (
                <p className="text-[13px] text-danger" role="alert">{errorMsg}</p>
              ) : null}
            </div>

            <div className="mt-auto flex flex-col gap-2 pb-4">
              <Button type="submit" size="lg" fullWidth loading={busy} disabled={!username.trim() || !password}>
                {t('onboarding.step1.loginCta')}
              </Button>
            </div>
          </form>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-[32px] font-extrabold leading-[1.15]">{t('onboarding.step2.title')}</h1>
            <p className="text-[15px] text-ink-muted">{t('onboarding.step2.subtitle')}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('onboarding.step2.title')}>
              {allSports().map((p) => {
                    return (
                  <Chip key={p.id} selected={sport === p.id} accent={sportAccent(p.id)} icon={<SportIcon name={p.icon} size={18} aria-hidden="true" />} onClick={() => setSport(p.id)}>
                    {t(p.nameKey)}
                  </Chip>
                );
              })}
            </div>
            <div className="mt-auto flex flex-col gap-2 pb-4">
              <Button
                size="lg"
                fullWidth
                disabled={!sport}
                onClick={() => {
                  if (sport) setDefaultSport(sport);
                  setStep(3);
                }}
              >
                {t('onboarding.step2.cta')}
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setStep(3)}>
                {t('common.skip')}
              </Button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="text-[32px] font-extrabold leading-[1.15]">{t('onboarding.step3.title')}</h1>
            <p className="text-[15px] text-ink-muted">{t('onboarding.step3.subtitle')}</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bulk" className="text-[13px] font-semibold tracking-[0.02em] text-ink-muted">
                {t('onboarding.step3.label')}
              </label>
              <textarea
                id="bulk"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                rows={8}
                placeholder={t('onboarding.step3.bulkPlaceholder')}
                className="min-h-44 w-full resize-none rounded-md border border-line bg-surface-2 p-4 text-ink outline-none focus:border-line-strong"
              />
              <p className="num text-[13px] text-ink-muted" aria-live="polite">
                {t('onboarding.step3.count', { count: names.length })}
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-2 pb-4">
              <Button size="lg" fullWidth disabled={names.length === 0} onClick={submitPlayers} leftIcon={<ArrowRight size={18} aria-hidden="true" />}>
                {t('onboarding.step3.cta')}
              </Button>
              <Button variant="ghost" fullWidth onClick={finish}>
                {t('onboarding.step3.skip')}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
