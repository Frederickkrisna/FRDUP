import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/components/cn';
import { allMatchesSettled } from '@/core/session/sessionEngine';
import type { RoundDoc } from '@/types/round';

type Props = {
  /** Sorted by round number, oldest first. */
  rounds: RoundDoc[];
  /** The round on screen. */
  shownId: string;
  /** The round being played (first one with an open match). */
  liveId: string;
  onSelect: (roundId: string) => void;
};

/**
 * Every round as one tap target: go back to fix an old score, look ahead, return to the live round.
 * The live round carries a dot, finished rounds a check; the round on screen is the raised pill.
 */
export function RoundStrip({ rounds, shownId, liveId, onSelect }: Props) {
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement>(null);
  const shownRef = useRef<HTMLButtonElement>(null);

  // Centre the shown pill by scrolling the strip sideways only (scrollIntoView would also move the page).
  useEffect(() => {
    const nav = navRef.current;
    const pill = shownRef.current;
    if (!nav || !pill) return;
    const n = nav.getBoundingClientRect();
    const p = pill.getBoundingClientRect();
    nav.scrollLeft += p.left - n.left - (n.width - p.width) / 2;
  }, [shownId, rounds.length]);

  return (
    <nav ref={navRef} aria-label={t('session.court.roundNav')} className="hide-scrollbar -mx-4 overflow-x-auto px-4">
      <ol className="flex w-max gap-2">
        {rounds.map((r) => {
          const shown = r.id === shownId;
          const live = r.id === liveId;
          const done = !live && allMatchesSettled(r);
          return (
            <li key={r.id}>
              <button
                ref={shown ? shownRef : undefined}
                type="button"
                aria-current={shown ? 'true' : undefined}
                aria-label={t(live ? 'session.court.roundPillLive' : done ? 'session.court.roundPillDone' : 'session.court.roundPill', { number: r.roundNumber })}
                onClick={() => onSelect(r.id)}
                className={cn(
                  'pressable no-select num relative flex h-11 min-w-11 items-center justify-center gap-1 rounded-md border px-3 text-[15px] font-bold',
                  shown ? 'border-line-strong bg-surface-3 text-ink' : 'border-line bg-surface text-ink-muted',
                )}
              >
                {r.roundNumber}
                {done ? <Check size={13} strokeWidth={3} className="text-success" aria-hidden="true" /> : null}
                {live ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
