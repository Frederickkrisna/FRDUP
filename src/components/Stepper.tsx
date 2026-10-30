import { Minus, Plus } from 'lucide-react';
import { cn } from './cn';

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible names, already translated by the caller. */
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  size?: 'md' | 'lg';
  className?: string;
};

/** −/+ with a tappable-sized numeric centre. `lg` uses the 64px score-button target. */
export function Stepper({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, label, decreaseLabel, increaseLabel, size = 'md', className }: Props) {
  const dim = size === 'lg' ? 'size-16' : 'size-12';
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center gap-3', className)}>
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={cn('pressable no-select grid place-items-center rounded-md border border-line bg-surface-2 text-ink disabled:opacity-35', dim)}
      >
        <Minus size={20} strokeWidth={2} aria-hidden="true" />
      </button>
      <output aria-live="polite" className={cn('num min-w-10 text-center font-bold', size === 'lg' ? 'text-3xl' : 'text-xl')}>
        {value}
      </output>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={cn('pressable no-select grid place-items-center rounded-md border border-line bg-surface-2 text-ink disabled:opacity-35', dim)}
      >
        <Plus size={20} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
