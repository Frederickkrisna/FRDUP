import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  fullWidth?: boolean;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-on disabled:bg-primary-dim',
  secondary: 'bg-surface-2 text-ink border border-line pressable-hover',
  ghost: 'bg-transparent text-ink-muted pressable-hover',
  danger: 'bg-danger text-danger-on',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 text-[15px]',
  md: 'min-h-12 px-5 text-[15px]',
  lg: 'min-h-[52px] px-6 text-base',
};

function Spinner() {
  return (
    <svg className="spin size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading = false, leftIcon, fullWidth = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'pressable no-select inline-flex items-center justify-center gap-2 rounded-md font-semibold disabled:cursor-not-allowed disabled:opacity-45',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      <span className="truncate">{children}</span>
    </button>
  );
});
