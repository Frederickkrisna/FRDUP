import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/Chip';
import { Stepper } from '@/components/Stepper';
import type { SportPlugin } from '@/types/sport';

type Config = Record<string, number | boolean | string>;

type Props = {
  plugin: SportPlugin;
  value: Config;
  onChange: (next: Config) => void;
};

/** Renders `plugin.settings` generically — adding a sport adds its settings UI for free. */
export function SportSettingsForm({ plugin, value, onChange }: Props) {
  const { t } = useTranslation();
  if (plugin.settings.length === 0) return <p className="text-[14px] text-ink-faint">{t('settings.sportsNone')}</p>;

  const set = (key: string, v: number | boolean | string) => onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-5">
      {plugin.settings.map((def) => {
        const current = value[def.key] ?? def.default;
        return (
          <div key={def.key} className="flex flex-col gap-2">
            <p id={`set-${plugin.id}-${def.key}`} className="text-[13px] font-semibold tracking-[0.02em] text-ink-muted">
              {t(def.labelKey)}
            </p>
            {def.type === 'select' ? (
              <div role="group" aria-labelledby={`set-${plugin.id}-${def.key}`} className="flex flex-wrap gap-2">
                {def.options?.map((o) => (
                  <Chip key={String(o.value)} selected={current === o.value} onClick={() => set(def.key, o.value)}>
                    {t(o.labelKey)}
                  </Chip>
                ))}
              </div>
            ) : null}
            {def.type === 'boolean' ? (
              <button
                type="button"
                role="switch"
                aria-checked={current === true}
                aria-labelledby={`set-${plugin.id}-${def.key}`}
                onClick={() => set(def.key, current !== true)}
                className="pressable inline-flex min-h-12 w-fit items-center gap-3 rounded-full border border-line bg-surface-2 px-2 pr-4"
              >
                <span className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${current === true ? 'bg-primary' : 'bg-surface-3'}`}>
                  <span
                    aria-hidden="true"
                    className={`absolute top-1 size-5 rounded-full transition-transform duration-200 ease-[var(--ease-out)] ${current === true ? 'translate-x-6 bg-primary-on' : 'translate-x-1 bg-ink-muted'}`}
                  />
                </span>
                <span className="text-[15px] font-semibold">{current === true ? t('common.on') : t('common.off')}</span>
              </button>
            ) : null}
            {def.type === 'number' ? (
              <Stepper
                value={typeof current === 'number' ? current : Number(def.default)}
                onChange={(n) => set(def.key, n)}
                min={def.min}
                max={def.max}
                label={t(def.labelKey)}
                decreaseLabel={t('common.decrease')}
                increaseLabel={t('common.increase')}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
