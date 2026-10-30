import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { IMPLEMENTED_FORMATS } from '@/core/session/sessionEngine';
import { SportSettingsForm } from '@/features/settings/SportSettingsForm';
import { useSetupDraft } from '@/features/shared/people';
import type { SessionFormat, SportPlugin } from '@/types/sport';

/** Step 3: format + the sport's own settings (rendered generically from `plugin.settings`). */
export function SetupFormatStep({ plugin, config }: { plugin: SportPlugin; config: Record<string, number | boolean | string> }) {
  const { t } = useTranslation();
  const format = useSetupDraft((s) => s.format) as SessionFormat;
  const title = useSetupDraft((s) => s.title);
  const venue = useSetupDraft((s) => s.venue);
  const patch = useSetupDraft((s) => s.patch);

  const formats = IMPLEMENTED_FORMATS.filter((f) => plugin.supportsFormats.includes(f));

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="fmt">
        <h2 id="fmt" className="mb-2 text-[17px] font-bold">
          {t('session.setup.format.title')}
        </h2>
        <SegmentedControl<SessionFormat>
          ariaLabel={t('session.setup.format.title')}
          value={formats.includes(format as (typeof IMPLEMENTED_FORMATS)[number]) ? format : (formats[0] ?? 'americano')}
          onChange={(f) => patch({ format: f })}
          options={formats.map((f) => ({ value: f, label: t(`session.setup.format.${f}`) }))}
        />
        <p className="mt-2 text-[13px] text-ink-muted">{t(`session.setup.format.${format === 'mexicano' ? 'mexicano' : 'americano'}Desc`)}</p>
      </section>

      {plugin.settings.length > 0 ? (
        <section aria-labelledby="sport-settings">
          <h2 id="sport-settings" className="mb-3 text-[17px] font-bold">
            {t('session.setup.settingsTitle', { sport: t(plugin.nameKey) })}
          </h2>
          <div className="rounded-lg border border-line bg-surface p-4">
            <SportSettingsForm plugin={plugin} value={config} onChange={(next) => patch({ config: next })} />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4" aria-labelledby="details">
        <h2 id="details" className="text-[17px] font-bold">
          {t('session.setup.detailsTitle')}
        </h2>
        <TextField label={t('session.setup.titleLabel')} value={title} onChange={(e) => patch({ title: e.target.value })} placeholder={t('session.setup.titlePlaceholder')} maxLength={50} autoComplete="off" />
        <TextField label={t('session.setup.venueLabel')} value={venue} onChange={(e) => patch({ venue: e.target.value })} placeholder={t('session.setup.venuePlaceholder')} maxLength={50} autoComplete="off" />
      </section>
    </div>
  );
}
