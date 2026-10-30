import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SkeletonRows } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { i18n } from '@/i18n';
import { hostRepo } from '@/data/hostRosterRepo';
import { signOutDevice } from '@/data/firebase';
import { DataSection } from '@/features/settings/DataSection';
import { PaymentSection } from '@/features/settings/PaymentSection';
import { SportSettingsForm } from '@/features/settings/SportSettingsForm';
import { allSports, sportAccent } from '@/features/shared/sportMeta';
import { useHost } from '@/features/shared/useHost';
import { useAppStore } from '@/state/appStore';
import { useBootStore } from '@/state/bootStore';
import type { SportId } from '@/types/sport';

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4" aria-labelledby={`${id ?? title}-h`}>
      <h2 id={`${id ?? title}-h`} className="mb-3 text-[17px] font-bold">
        {title}
      </h2>
      <div className="rounded-lg border border-line bg-surface p-4">{children}</div>
    </section>
  );
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const hostId = useAppStore((s) => s.hostId);
  const host = useHost(hostId);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const setHostName = useAppStore((s) => s.setHostName);
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [sportId, setSportId] = useState<SportId>('badminton');

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash, host]);

  if (!hostId || host === undefined) return <div className="pt-safe px-4 pt-6"><SkeletonRows count={4} /></div>;
  if (host === null) return null;

  const plugin = allSports().find((s) => s.id === sportId) ?? allSports()[0];

  return (
    <div className="pt-safe flex flex-col gap-6 px-4 pb-6">
      <h1 className="pt-6 text-[32px] font-extrabold leading-none">{t('settings.title')}</h1>

      <Section title={t('settings.profile')}>
        <TextField
          label={t('settings.hostName')}
          value={name ?? host.displayName}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const clean = (name ?? host.displayName).trim();
            if (clean && clean !== host.displayName) {
              hostRepo.update(host.id, { displayName: clean });
              setHostName(clean);
            }
            setName(null);
          }}
          maxLength={40}
          autoComplete="given-name"
        />
      </Section>

      <Section title="Akun">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold">{host.displayName || 'Fred'}</p>
            <p className="text-[13px] text-ink-muted">Akun bersama (fred@frdup.app)</p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await signOutDevice();
              useAppStore.getState().reset();
              useBootStore.setState({ uid: null });
              void navigate('/onboarding', { replace: true });
            }}
          >
            Keluar
          </Button>
        </div>
      </Section>

      <Section title={t('settings.language')}>
        <SegmentedControl<'id' | 'en'>
          ariaLabel={t('settings.language')}
          value={locale}
          onChange={(l) => {
            setLocale(l);
            void i18n.changeLanguage(l);
            hostRepo.update(host.id, { locale: l });
          }}
          options={[
            { value: 'id', label: t('settings.languageId') },
            { value: 'en', label: t('settings.languageEn') },
          ]}
        />
      </Section>

      <Section title={t('settings.rounding')}>
        <SegmentedControl<'100' | '500' | '1000'>
          ariaLabel={t('settings.rounding')}
          value={String(host.roundingTo) as '100' | '500' | '1000'}
          onChange={(v) => hostRepo.update(host.id, { roundingTo: Number(v) })}
          options={[
            { value: '100', label: t('bill.rounding.100') },
            { value: '500', label: t('bill.rounding.500') },
            { value: '1000', label: t('bill.rounding.1000') },
          ]}
        />
        <p className="mt-2 text-[13px] text-ink-faint">{t('settings.roundingHint')}</p>
      </Section>

      <Section id="payment" title={t('settings.payment.title')}>
        <PaymentSection key={host.id} host={host} />
      </Section>

      <Section title={t('settings.sports')}>
        <div className="hide-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1" role="group" aria-label={t('settings.sports')}>
          {allSports().map((s) => (
            <Chip key={s.id} selected={sportId === s.id} accent={sportAccent(s.id)} onClick={() => setSportId(s.id)}>
              {t(s.nameKey)}
            </Chip>
          ))}
        </div>
        {plugin ? (
          <SportSettingsForm
            key={plugin.id}
            plugin={plugin}
            value={host.sportDefaults[plugin.id] ?? {}}
            onChange={(next) => hostRepo.update(host.id, { sportDefaults: { ...host.sportDefaults, [plugin.id]: next } })}
          />
        ) : null}
      </Section>

      <Section id="data" title={t('settings.data.title')}>
        <DataSection hostId={host.id} />
      </Section>

      <p className="num pb-2 text-center text-[12px] text-ink-faint">
        {t('common.appName')} · {t('common.version')} {__APP_VERSION__}
      </p>
    </div>
  );
}
