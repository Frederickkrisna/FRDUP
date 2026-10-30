import { useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { useModalDialog } from './useModalDialog';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Pinned under the scroll area (primary action). Sits above the safe-area inset. */
  footer?: ReactNode;
  /** Label for the dismiss control (already translated). */
  closeLabel: string;
};

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.11; // px/ms — a quick flick dismisses regardless of distance

/**
 * Bottom sheet on a native <dialog>: focus is trapped and restored by the platform, Esc closes.
 * Drag the handle down to dismiss; the panel follows the finger via transform only and keeps
 * momentum (velocity-based dismissal). Reduced motion: opacity only.
 */
export function Sheet({ open, onClose, title, children, footer, closeLabel }: Props) {
  const { ref, visible } = useModalDialog(open, onClose);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startT: number; id: number } | null>(null);
  const titleId = useId();

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current) return; // ignore a second finger
    drag.current = { startY: e.clientY, startT: performance.now(), id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (panel.current) panel.current.style.transition = 'none';
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id || !panel.current) return;
    const dy = e.clientY - d.startY;
    // Friction when pulling up past the resting position; 1:1 when pulling down.
    panel.current.style.transform = `translateY(${dy < 0 ? dy * 0.18 : dy}px)`;
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id || !panel.current) return;
    drag.current = null;
    const dy = e.clientY - d.startY;
    const velocity = dy / Math.max(1, performance.now() - d.startT);
    panel.current.style.transition = '';
    if (dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      panel.current.style.transform = '';
      onClose();
    } else {
      panel.current.style.transform = '';
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 hidden h-full max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-transparent open:flex open:flex-col open:justify-end"
    >
      <div
        aria-hidden="true"
        className={cn('absolute inset-0 bg-[var(--c-overlay)] transition-opacity duration-200', visible ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        ref={panel}
        className={cn(
          'relative mx-auto flex max-h-[calc(100dvh-var(--safe-top)-16px)] w-full max-w-[560px] flex-col rounded-t-xl border border-b-0 border-line bg-surface',
          'transition-[transform,opacity] duration-[320ms] ease-[var(--ease-drawer)] motion-reduce:transition-opacity',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 motion-reduce:translate-y-0',
        )}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-1 pt-2"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
          <div className="flex w-full items-center justify-between px-5 pb-2 pt-3">
            <h2 id={titleId} className="text-[20px] font-bold text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              onPointerDown={(e) => e.stopPropagation()}
              className="pressable grid size-11 place-items-center rounded-full text-ink-muted"
            >
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="scroll-y min-h-0 flex-1 px-5 pb-4">{children}</div>
        {footer ? <div className="shrink-0 border-t border-line bg-surface px-5 pb-[max(1rem,var(--safe-bottom))] pt-3">{footer}</div> : <div className="pb-safe" />}
      </div>
    </dialog>
  );
}
