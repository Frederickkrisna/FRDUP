import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/components/cn';
import type { RoundDoc } from '@/types/round';

type Props = {
  /** Sorted by round number, oldest first. */
  rounds: RoundDoc[];
  /** The round on screen. */
  shownId: string;
  /** The newest round (the one being played). */
  liveId: string;
  onSelect: (roundId: string) => void;
};

/**
 * Every round as one tap target: go back to fix an old score, come back to the live round.
 * The live round carries a dot; the round on screen is the raised pill.
 */
export function RoundStrip({ rounds, shownId, liveId, onSelect }: Props) {
  const { t } = useTranslation();
  const shownRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    shownRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [shownId, rounds.length]);

  return (
    <nav aria-label={t('session.court.roundNav')} className="hide-scrollbar -mx-4 overflow-x-auto px-4">
      <ol className="flex w-max gap-2">
        {rounds.map((r) => {
          const shown = r.id === shownId;
          const live = r.id === liveId;
          return (
            <li key={r.id}>
              <button
                ref={shown ? shownRef : undefined}
                type="button"
                aria-current={shown ? 'true' : undefined}
                aria-label={t(live ? 'session.court.roundPillLive' : 'session.court.roundPill', { number: r.roundNumber })}
                onClick={() => onSelect(r.id)}
                className={cn(
                  'pressable no-select num relative grid h-11 min-w-11 place-items-center rounded-md border px-3 text-[15px] font-bold',
                  shown ? 'border-line-strong bg-surface-3 text-ink' : 'border-line bg-surface text-ink-muted',
                )}
              >
                {r.roundNumber}
                {live ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
