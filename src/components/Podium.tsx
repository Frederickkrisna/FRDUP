import type { ReactNode } from 'react';
import { Crown } from 'lucide-react';
import { Avatar } from './Avatar';
import { cn } from './cn';

export interface PodiumItem {
  key: string;
  rank: 1 | 2 | 3;
  name: string;
  initials: string;
  color: string;
  src?: string | null;
  /** Pre-formatted value under the name (points, RP…). */
  value: string;
  badge?: ReactNode;
}

const HEIGHT: Record<1 | 2 | 3, string> = { 1: 'h-28', 2: 'h-20', 3: 'h-14' };
const ORDER: Array<1 | 2 | 3> = [2, 1, 3];

/**
 * Three columns (2nd · 1st · 3rd) with step heights. Columns grow from the floor with a transform,
 * 1st last, so the winner lands as the reveal. Rank is a numeral — never colour alone.
 */
export function Podium({ items, rankLabel }: { items: PodiumItem[]; rankLabel: (rank: number) => string }) {
  const by = new Map(items.map((i) => [i.rank, i]));
  return (
    <ol className="grid grid-cols-3 items-end gap-2" aria-label={rankLabel(1)}>
      {ORDER.map((rank) => {
        const item = by.get(rank);
        if (!item) return <li key={rank} aria-hidden="true" />;
        const delay = rank === 1 ? 260 : rank === 2 ? 120 : 0;
        return (
          <li key={item.key} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            {rank === 1 ? <Crown size={20} aria-hidden="true" style={{ color: 'var(--tier-legend)' }} /> : <span className="h-5" aria-hidden="true" />}
            <Avatar name={item.name} initials={item.initials} color={item.color} src={item.src} size={rank === 1 ? 'lg' : 'md'} />
            <p className="w-full truncate text-[15px] font-bold">{item.name}</p>
            <div className="min-h-[38px]">{item.badge}</div>
            <div
              className={cn(
                'rise-in w-full origin-bottom rounded-t-md border border-b-0 border-line-strong bg-surface-2 pt-2',
                HEIGHT[rank],
              )}
              style={{ animationDelay: `${delay}ms` }}
            >
              <p className="num text-[22px] font-bold leading-none">{rank}</p>
              <p className="num mt-1 truncate px-1 text-[13px] text-ink-muted">{item.value}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
