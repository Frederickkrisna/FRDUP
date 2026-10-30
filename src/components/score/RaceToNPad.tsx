import { Check, Minus, Plus } from 'lucide-react';
import { haptic } from '../haptics';
import { cn } from '../cn';
import { ScoreDigits } from './ScoreDigits';
import type { PadProps } from './types';

/** True once both sides are within one point of the target and the margin rule is live. */
export function isDeuce(points: number[], target: number, deuceEnabled: boolean, hardCap?: number): boolean {
  if (!deuceEnabled) return false;
  const a = points[0] ?? 0;
  const b = points[1] ?? 0;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (lo < target - 1) return false;
  if (hardCap !== undefined && hi >= hardCap) return false;
  return Math.abs(a - b) < 2;
}

/** Badminton / table tennis: two big counters, one-thumb +1 targets, DEUCE pill when live. */
export function RaceToNPad({ spec, points, teamNames, winnerTeamIndex, disabled, labels, onChange }: PadProps) {
  const target = spec.targetScore ?? 21;
  const deuce = isDeuce(points, target, spec.deuceEnabled ?? true, spec.hardCap);

  const bump = (teamIndex: number, value: 1 | -1) => {
    haptic('tap');
    onChange({ teamIndex, value, mode: 'delta' });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => {
          const v = points[i] ?? 0;
          const won = winnerTeamIndex === i;
          return (
            <div key={i} className="flex min-w-0 flex-col items-stretch gap-3">
              <p className="truncate text-center text-[15px] font-semibold text-ink-muted">{teamNames[i]}</p>
              <div className="flex items-center justify-center gap-2">
                <ScoreDigits value={v} className={won ? 'text-success' : undefined} />
                {won ? <Check size={28} className="text-success" aria-hidden="true" /> : null}
              </div>
              <button
                type="button"
                disabled={disabled}
                aria-label={labels.increase(teamNames[i] ?? '', v + 1)}
                onClick={() => bump(i, 1)}
                className={cn('pressable no-select grid h-16 place-items-center rounded-md border border-line-strong bg-surface-3 text-ink disabled:opacity-35')}
              >
                <Plus size={28} strokeWidth={2.5} aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={disabled || v <= 0}
                aria-label={labels.decrease(teamNames[i] ?? '', v - 1)}
                onClick={() => bump(i, -1)}
                className="pressable no-select grid h-14 place-items-center rounded-md border border-line bg-surface-2 text-ink-muted disabled:opacity-35"
              >
                <Minus size={22} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex min-h-8 items-center justify-center">
        {deuce ? <span className="rounded-full border border-warning px-3 py-1 text-[12px] font-extrabold tracking-[0.08em] text-warning">{labels.deuce}</span> : null}
      </div>
      <p className="text-center text-[13px] text-ink-faint">{labels.rule}</p>
    </div>
  );
}
