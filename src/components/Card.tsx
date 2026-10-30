import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: 'flat' | 'raised' | 'interactive';
  /** CSS colour (a var(--sport-*) reference) that tints the full 1px border. */
  accent?: string;
  active?: boolean;
  children: ReactNode;
};

/**
 * Elevation on dark surfaces is a lighter fill plus a 1px border, never a shadow.
 * `accent` tints the whole border (not a one-sided stripe).
 */
export function Card({ variant = 'flat', accent, active = false, className, style, children, ...rest }: Props) {
  const tint: CSSProperties | undefined = accent
    ? { borderColor: `color-mix(in srgb, ${accent} 55%, var(--c-border))`, ...style }
    : style;
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        variant === 'flat' ? 'border-line bg-surface' : 'border-line bg-surface-2',
        variant === 'interactive' && 'pressable cursor-pointer pressable-hover',
        active && 'border-primary',
        className,
      )}
      style={tint}
      {...rest}
    >
      {children}
    </div>
  );
}
