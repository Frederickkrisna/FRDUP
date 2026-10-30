import type { ReactNode } from 'react';
import { cn } from './cn';

type Option<T extends string> = { value: T; label: string; icon?: ReactNode };

type Props<T extends string> = {
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
};

/** Segmented picker. The indicator slides with a transform transition (no layout animation). */
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, className }: Props<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('relative grid rounded-md border border-line bg-surface p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 top-1 rounded-sm bg-surface-3 transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none"
        style={{ width: `calc((100% - 8px) / ${options.length})`, left: 4, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'pressable no-select relative z-10 flex min-h-11 items-center justify-center gap-1.5 rounded-sm px-2 text-[14px] font-semibold',
              selected ? 'text-ink' : 'text-ink-muted',
            )}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
