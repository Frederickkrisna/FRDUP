import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { haptic } from '../haptics';
import { cn } from '../cn';
import { ScoreDigits } from './ScoreDigits';
import type { PadProps } from './types';

/**
 * Padel / Americano: A + B always equals the total, so one tap on a number settles both sides.
 * Pick the side, tap its score; the other side is whatever is left. ± stays for live counting.
 */
export function FixedSumPad({ spec, points, teamNames, disabled, labels, onChange }: PadProps) {
  const total = spec.fixedTotal ?? 21;
  const [side, setSide] = useState<0 | 1>(0);
  const score = [points[0] ?? 0, points[1] ?? 0] as const;
  const entered = score[0] + score[1] === total;

  const pick = (value: number) => {
    haptic('tap');
    onChange({ teamIndex: side, value, mode: 'set' });
  };
  const step = (teamIndex: 0 | 1, value: 1 | -1) => {
    haptic('tap');
    onChange({ teamIndex, value, mode: 'delta' });
  };

  const stepBtn = 'pressable no-select grid size-14 place-items-center rounded-md border border-line bg-surface-2 text-ink disabled:opacity-35';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={side === i}
            onClick={() => setSide(i)}
            className={cn('pressable no-select min-w-0 rounded-md border px-2 pb-3 pt-2.5 text-center', side === i ? 'border-primary bg-surface-2' : 'border-line')}
          >
            <span className={cn('block truncate text-[14px] font-semibold', side === i ? 'text-ink' : 'text-ink-muted')}>{teamNames[i]}</span>
            <ScoreDigits value={score[i]} className={side === i ? undefined : 'text-ink-muted'} />
          </button>
        ))}
      </div>

      <p className="text-center text-[13px] text-ink-muted">
        {labels.pickFor(teamNames[side] ?? '')} · {labels.total}
      </p>

      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: total + 1 }, (_, n) => {
          const current = entered && score[side] === n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              aria-pressed={current}
              aria-label={labels.setScore(teamNames[side] ?? '', n)}
              onClick={() => pick(n)}
              className={cn(
                'pressable no-select num grid h-12 place-items-center rounded-md border text-[17px] font-bold disabled:opacity-35',
                current ? 'border-primary bg-primary text-primary-on' : 'border-line bg-surface-2 text-ink',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((i) => (
          <div key={i} className="flex items-center justify-center gap-3">
            <button type="button" disabled={disabled || score[i] <= 0} aria-label={labels.decrease(teamNames[i] ?? '', score[i] - 1)} className={stepBtn} onClick={() => step(i, -1)}>
              <Minus size={22} aria-hidden="true" />
            </button>
            <button type="button" disabled={disabled || score[i] >= total} aria-label={labels.increase(teamNames[i] ?? '', score[i] + 1)} className={stepBtn} onClick={() => step(i, 1)}>
              <Plus size={22} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
