import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { haptic } from '../haptics';
import { cn } from '../cn';
import { ScoreDigits } from './ScoreDigits';
import type { PadProps } from './types';

/**
 * Padel / Americano: A + B always equals the total, so the split bar IS the interface.
 * Dragging either side moves the other; the invariant is made visible, not just enforced.
 */
export function FixedSumPad({ spec, points, teamNames, disabled, labels, onChange }: PadProps) {
  const total = spec.fixedTotal ?? 21;
  const a = points[0] ?? 0;
  const b = points[1] ?? 0;
  const bar = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromX = (clientX: number) => {
    const el = bar.current;
    if (!el || disabled) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = Math.round(ratio * total);
    if (next !== a) {
      haptic('tap');
      onChange({ teamIndex: 0, value: next, mode: 'set' });
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromX(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) setFromX(e.clientX);
  };
  const onPointerEnd = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange({ teamIndex: 0, value: -1, mode: 'delta' });
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange({ teamIndex: 0, value: 1, mode: 'delta' });
    else return;
    e.preventDefault();
  };

  const step = (teamIndex: 0 | 1, value: 1 | -1) => {
    haptic('tap');
    onChange({ teamIndex, value, mode: 'delta' });
  };

  const btn = 'pressable no-select grid size-16 place-items-center rounded-md border border-line bg-surface-2 text-ink disabled:opacity-35';

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 text-center">
        {([0, 1] as const).map((i) => (
          <div key={i} className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink-muted">{teamNames[i]}</p>
            <ScoreDigits value={i === 0 ? a : b} />
          </div>
        ))}
      </div>

      <div
        ref={bar}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={labels.sliderLabel}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={a}
        aria-valuetext={`${a} : ${b}`}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        className={cn('no-select relative h-14 touch-none overflow-hidden rounded-md border border-line bg-surface-3', disabled && 'opacity-50')}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 origin-left bg-primary transition-transform duration-100 ease-[var(--ease-out)] motion-reduce:transition-none"
          style={{ transform: `scaleX(${total === 0 ? 0 : a / total})` }}
        />
        <div aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-bg" style={{ left: `${total === 0 ? 0 : (a / total) * 100}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([0, 1] as const).map((i) => (
          <div key={i} className="flex items-center justify-center gap-3">
            <button type="button" disabled={disabled || (i === 0 ? a <= 0 : b <= 0)} aria-label={labels.decrease(teamNames[i] ?? '', (i === 0 ? a : b) - 1)} className={btn} onClick={() => step(i, -1)}>
              <Minus size={22} aria-hidden="true" />
            </button>
            <button type="button" disabled={disabled || (i === 0 ? a >= total : b >= total)} aria-label={labels.increase(teamNames[i] ?? '', (i === 0 ? a : b) + 1)} className={btn} onClick={() => step(i, 1)}>
              <Plus size={22} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <p className="num text-center text-[15px] text-ink-muted">{labels.total}</p>
    </div>
  );
}
