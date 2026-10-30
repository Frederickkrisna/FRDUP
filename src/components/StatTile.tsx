import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from './cn';

type Props = {
  label: string;
  value: ReactNode;
  /** Signed change; renders an arrow + sign (never colour alone). */
  delta?: number;
  className?: string;
};

export function StatTile({ label, value, delta, className }: Props) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface p-4', className)}>
      <p className="text-[13px] font-semibold text-ink-muted">{label}</p>
      <p className="num mt-1 text-[28px] font-bold leading-none text-ink">{value}</p>
      {delta !== undefined && delta !== 0 ? (
        <p className={cn('num mt-2 inline-flex items-center gap-1 text-[13px] font-medium', delta > 0 ? 'text-success' : 'text-danger')}>
          {delta > 0 ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
          {delta > 0 ? `+${delta}` : delta}
        </p>
      ) : null}
    </div>
  );
}
