import { useTranslation } from 'react-i18next';

import { Stepper } from '@/components/Stepper';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { LIMITS, playersPerMatch, rotationPreview } from '@/core/session/sessionEngine';
import { useSetupDraft } from '@/features/shared/people';
import type { MatchShape, SportPlugin } from '@/types/sport';

type Props = {
  plugin: SportPlugin;
  playerCount: number;
  shape: MatchShape;
};

/** Default labels: "Lapangan 1", "Meja 2"… The label noun comes from the plugin. */
export function defaultCourtLabel(noun: string, index: number): string {
  return `${noun} ${index + 1}`;
}

/** Step 2: how many courts, what to call them, and the fairness preview in plain words. */
export function SetupCourtsStep({ plugin, playerCount, shape }: Props) {
  const { t } = useTranslation();
  const courtCount = useSetupDraft((s) => s.courtCount) ?? plugin.defaultCourtCount;
  const labels = useSetupDraft((s) => s.courtLabels);
  const targetRounds = useSetupDraft((s) => s.targetRounds);
  const patch = useSetupDraft((s) => s.patch);

  const noun = t(plugin.courtLabelKey);
  const label = (i: number) => labels[i] ?? defaultCourtLabel(noun, i);
  const preview = rotationPreview(playerCount, courtCount, shape);
  const per = playersPerMatch(shape);
  const underfilled = preview.activeCourts < courtCount;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-bold">{t('session.setup.courts.count', { noun })}</h2>
          <p className="text-[13px] text-ink-muted">{t('session.setup.courts.countHint', { max: LIMITS.courts })}</p>
        </div>
        <Stepper
          value={courtCount}
          min={1}
          max={LIMITS.courts}
          onChange={(n) => patch({ courtCount: n })}
          label={t('session.setup.courts.count', { noun })}
          decreaseLabel={t('common.decrease')}
          increaseLabel={t('common.increase')}
        />
      </section>

      <section aria-live="polite" className="rounded-lg border border-line bg-surface p-4">
        <p className="text-[15px] font-semibold">
          {t('session.setup.courts.fairnessPreview', { players: playerCount, courts: courtCount, playing: preview.playing, resting: preview.resting })}
        </p>
        {underfilled ? <p className="mt-1.5 text-[13px] text-warning">{t('session.setup.courts.underfilled', { needed: per, active: preview.activeCourts })}</p> : null}
        {preview.resting > 0 && preview.activeCourts > 0 ? <p className="mt-1.5 text-[13px] text-ink-muted">{t('session.setup.courts.restNote')}</p> : null}
      </section>

      <section aria-labelledby="court-labels">
        <h2 id="court-labels" className="mb-2 text-[17px] font-bold">
          {t('session.setup.courts.label')}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: courtCount }, (_, i) => (
            <TextField
              key={i}
              label={t('session.setup.courts.labelN', { n: i + 1 })}
              value={label(i)}
              onChange={(e) => {
                const next = Array.from({ length: courtCount }, (_, j) => (j === i ? e.target.value : label(j)));
                patch({ courtLabels: next });
              }}
              maxLength={24}
              autoComplete="off"
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="target-rounds" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="target-rounds" className="text-[17px] font-bold">
              {t('session.setup.courts.targetRounds')}
            </h2>
            <p className="text-[13px] text-ink-muted">{t('session.setup.courts.targetRoundsHint')}</p>
          </div>
          <Chip selected={targetRounds === null} onClick={() => patch({ targetRounds: targetRounds === null ? 8 : null })}>
            {t('session.setup.courts.openEnded')}
          </Chip>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'session.setup.courts.preset1h', rounds: 4 },
            { key: 'session.setup.courts.preset1h5', rounds: 6 },
            { key: 'session.setup.courts.preset2h', rounds: 8 },
            { key: 'session.setup.courts.preset2h5', rounds: 10 },
            { key: 'session.setup.courts.preset3h', rounds: 12 },
          ].map((preset) => (
            <Chip
              key={preset.rounds}
              selected={targetRounds === preset.rounds}
              onClick={() => patch({ targetRounds: preset.rounds })}
            >
              {`${t(preset.key)} (${t('session.setup.courts.presetRounds', { n: preset.rounds })})`}
            </Chip>
          ))}
        </div>

        {targetRounds !== null ? (
          <div className="mt-1 flex items-center justify-between gap-4 rounded-md border border-line bg-surface-2 p-3">
            <div>
              <p className="text-[14px] font-semibold">{t('session.setup.courts.customRounds', { n: targetRounds })}</p>
              <p className="text-[12px] text-ink-muted">{t('session.setup.courts.customEstimate', { min: targetRounds * 15 })}</p>
            </div>
            <Stepper
              value={targetRounds}
              min={1}
              max={LIMITS.rounds}
              onChange={(n) => patch({ targetRounds: n })}
              label={t('session.setup.courts.targetRounds')}
              decreaseLabel={t('common.decrease')}
              increaseLabel={t('common.increase')}
            />
          </div>
        ) : (
          <p className="rounded-md border border-line bg-surface-2 p-3 text-[13px] text-ink-muted">
            {t('session.setup.courts.openEndedNote')}
          </p>
        )}
      </section>
    </div>
  );
}
