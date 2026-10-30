import { Star } from 'lucide-react';
import type { TierKey } from '@/types/rank';
import { cn } from './cn';

type Props = {
  tier: TierKey;
  filled: number;
  total?: number;
  size?: number;
  className?: string;
};

/** Filled/empty stars for the current division. Filling pops in with a short transform transition. */
export function StarTrack({ tier, filled, total = 3, size = 16, className }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden="true" style={{ color: `var(--tier-${tier})` }}>
      {Array.from({ length: total }, (_, i) => {
        const on = i < filled;
        return (
          <Star
            key={i}
            size={size}
            strokeWidth={2}
            fill={on ? 'currentColor' : 'none'}
            className={cn('transition-[transform,opacity] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none', on ? 'scale-100 opacity-100' : 'scale-90 opacity-45')}
          />
        );
      })}
    </span>
  );
}
