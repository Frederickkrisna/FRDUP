import { Minus, Plus } from 'lucide-react';
import { haptic } from '../haptics';
import { cn } from '../cn';
import { ScoreDigits } from './ScoreDigits';
import type { PadProps } from './types';

/** Billiard (fouls subtract) and Mahjong (4-way tally). No auto-completion; the host confirms. */
export function IncrementPad({ spec, points, teamNames, disabled, labels, onChange }: PadProps) {
  const step = spec.step ?? 1;
  const allowNegative = spec.allowNegative ?? false;
  const max = spec.maxPoints ?? Number.POSITIVE_INFINITY;
  const cols = Math.max(2, points.length);
  const dense = cols > 2;

  const bump = (teamIndex: number, dir: 1 | -1) => {
    haptic('tap');
    onChange({ teamIndex, value: dir * step, mode: 'delta' });
  };

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {points.map((v, i) => (
        <div key={i} className="flex min-w-0 flex-col items-stretch gap-2">
          <p className="truncate text-center text-[13px] font-semibold text-ink-muted">{teamNames[i]}</p>
          <div className="grid place-items-center">
            <ScoreDigits value={v} size={dense ? 'lg' : 'xl'} />
          </div>
          <button
            type="button"
            disabled={disabled || v + step > max}
            aria-label={labels.increase(teamNames[i] ?? '', v + step)}
            onClick={() => bump(i, 1)}
            className={cn('pressable no-select grid place-items-center rounded-md border border-line-strong bg-surface-3 text-ink disabled:opacity-35', dense ? 'h-14' : 'h-16')}
          >
            <Plus size={dense ? 22 : 28} strokeWidth={2.5} aria-hidden="true" />
          </button>
          {allowNegative || v - step >= 0 ? (
            <button
              type="button"
              disabled={disabled || (!allowNegative && v - step < 0)}
              aria-label={labels.decrease(teamNames[i] ?? '', v - step)}
              onClick={() => bump(i, -1)}
              className="pressable no-select grid h-14 place-items-center rounded-md border border-line bg-surface-2 text-ink-muted disabled:opacity-35"
            >
              <Minus size={20} aria-hidden="true" />
            </button>
          ) : (
            <div className="h-14" aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}
