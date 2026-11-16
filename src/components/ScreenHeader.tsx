import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from './cn';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
  /** Sport tint for session screens, as a CSS colour reference. */
  accent?: string;
  /** A thin row inside the sticky header (e.g. sync status), so it never scrolls away. */
  below?: ReactNode;
  className?: string;
};

/** App-style top bar: respects the notch, 56px, title left, one-handed back target. */
export function ScreenHeader({ title, subtitle, onBack, backLabel, right, accent, below, className }: Props) {
  return (
    <header className={cn('pt-safe sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur-sm', className)}>
      <div className="mx-auto flex min-h-14 w-full max-w-[560px] items-center gap-1 px-2">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label={backLabel} className="pressable grid size-11 shrink-0 place-items-center rounded-full text-ink">
            <ChevronLeft size={24} aria-hidden="true" />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-extrabold leading-tight text-ink">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[12px] leading-tight text-ink-muted">
              {accent ? <span aria-hidden="true" className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: accent }} /> : null}
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="flex shrink-0 items-center gap-1 pr-2">{right}</div> : null}
      </div>
      {below}
    </header>
  );
}
