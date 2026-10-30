import { Armchair } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { displayName } from '@/features/shared/people';
import { useParticipantMap } from './selectors';

/** Who is sitting out this round, as one quiet chip row (never a blocking element). */
export function RestingBench({ ids }: { ids: string[] }) {
  const { t } = useTranslation();
  const byId = useParticipantMap();
  return (
    <section aria-label={t('session.court.resting')} className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3">
      <Armchair size={20} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
      <div className="min-w-0">
        <h3 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">{t('session.court.resting')}</h3>
        {ids.length === 0 ? (
          <p className="text-[14px] text-ink-faint">{t('session.court.noResting')}</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {ids.map((id) => {
              const p = byId.get(id);
              return (
                <li key={id} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[14px] font-semibold">
                  {p ? displayName(p) : '?'}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
