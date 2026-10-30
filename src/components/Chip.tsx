import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  selected?: boolean;
  /** CSS colour reference (e.g. var(--sport-padel)) used when selected. */
  accent?: string;
  icon?: ReactNode;
};

/** Toggle chip: sport picker, player multi-select, filters. 48px high for thumbs. */
export function Chip({ selected = false, accent, icon, className, children, style, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'pressable no-select inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold',
        selected ? 'bg-surface-3 text-ink' : 'border-line bg-surface-2 text-ink-muted pressable-hover',
        className,
      )}
      style={selected ? { borderColor: accent ?? 'var(--c-primary)', ...style } : style}
      {...rest}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}
