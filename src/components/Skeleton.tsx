import type { CSSProperties } from 'react';
import { cn } from './cn';

/** Loading placeholder. Lists use skeletons, never spinners (docs/design.md §7.1). */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={cn('skeleton', className)} style={style} />;
}

export function SkeletonRows({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}
