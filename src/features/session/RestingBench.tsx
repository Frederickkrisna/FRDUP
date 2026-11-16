import { Armchair, ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { displayName } from '@/features/shared/people';
import { useParticipantMap } from './selectors';

/**
 * Who is sitting out this round, as one quiet chip row (never a blocking element). With `onPick`
 * (host, round not settled) each chip opens "play instead of…": the usual fix when someone on a
 * court has to step away (toilet, phone call) and a resting player goes in first.
 */
export function RestingBench({ ids, onPick }: { ids: string[]; onPick?: (playerId: string) => void }) {
  const { t } = useTranslation();
  const byId = useParticipantMap();
  return (
    <section aria-label={t('session.court.resting')} className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3">
      <Armchair size={20} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">{t('session.court.resting')}</h3>
        {ids.length === 0 ? (
          <p className="text-[14px] text-ink-faint">{t('session.court.noResting')}</p>
        ) : (
          <>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {ids.map((id) => {
                const p = byId.get(id);
                const name = p ? displayName(p) : '?';
                return (
                  <li key={id}>
                    {onPick ? (
                      <button
                        type="button"
                        onClick={() => onPick(id)}
                        aria-label={t('session.court.benchPlayIn', { name })}
                        className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-3.5 text-[14px] font-semibold"
                      >
                        {name}
                        <ArrowLeftRight size={14} className="text-ink-muted" aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="inline-block rounded-full border border-line bg-surface-2 px-3 py-1 text-[14px] font-semibold">{name}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {onPick ? <p className="mt-2 text-[12px] text-ink-faint">{t('session.court.benchHint')}</p> : null}
          </>
        )}
      </div>
    </section>
  );
}
