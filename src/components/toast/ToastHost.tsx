import { useEffect, useRef } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../cn';
import { useToastStore, type ToastItem, type ToastKind } from './toastStore';

const ICON: Record<ToastKind, typeof Info> = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };
const TONE: Record<ToastKind, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

function Toast({ item, dismissLabel }: { item: ToastItem; dismissLabel: string }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = ICON[item.kind];
  const startX = useRef<number | null>(null);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let remaining = item.durationMs;
    let started = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => dismiss(item.id), remaining);
    // Pause while the tab is hidden so nobody misses a message.
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (timer) clearTimeout(timer);
        remaining -= Date.now() - started;
        timer = null;
      } else if (!timer) {
        started = Date.now();
        timer = setTimeout(() => dismiss(item.id), Math.max(1000, remaining));
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [dismiss, item.durationMs, item.id]);

  return (
    <div
      ref={el}
      role={item.kind === 'danger' || item.kind === 'warning' ? 'alert' : 'status'}
      className="rise-in pointer-events-auto flex touch-pan-y items-center gap-3 rounded-lg border border-line-strong bg-surface-2 py-2 pl-4 pr-2 text-ink"
      onPointerDown={(e) => {
        startX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (startX.current !== null && Math.abs(e.clientX - startX.current) > 60) dismiss(item.id); // swipe to kill
        startX.current = null;
      }}
    >
      <Icon size={20} className={cn('shrink-0', TONE[item.kind])} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[15px] leading-snug">{item.message}</p>
      {item.actionLabel ? (
        <button
          type="button"
          className="pressable min-h-11 shrink-0 rounded-md px-3 text-[15px] font-bold text-primary"
          onClick={() => {
            item.onAction?.();
            dismiss(item.id);
          }}
        >
          {item.actionLabel}
        </button>
      ) : (
        <button type="button" aria-label={dismissLabel} className="pressable grid size-11 shrink-0 place-items-center rounded-full text-ink-faint" onClick={() => dismiss(item.id)}>
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Mounted once in the app shell. Sits above the tab bar and the safe-area inset. */
export function ToastHost({ dismissLabel }: { dismissLabel: string }) {
  const items = useToastStore((s) => s.items);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 mx-auto flex w-full max-w-[560px] flex-col gap-2 px-4"
      style={{ bottom: 'calc(var(--toast-bottom, var(--tabbar-h)) + var(--safe-bottom) + 12px)' }}
    >
      {items.map((item) => (
        <Toast key={item.id} item={item} dismissLabel={dismissLabel} />
      ))}
    </div>
  );
}
