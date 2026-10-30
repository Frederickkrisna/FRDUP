import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string;
  hint?: string;
  error?: string | null;
  endAdornment?: ReactNode;
};

/** 48px field, 16px text (iOS never auto-zooms), visible label, error tied by aria-describedby. */
export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, hint, error, endAdornment, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-[13px] font-semibold tracking-[0.02em] text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={cn(
            'min-h-12 w-full rounded-md border bg-surface-2 px-4 text-ink outline-none transition-colors duration-200',
            error ? 'border-danger' : 'border-line focus:border-line-strong',
            endAdornment ? 'pr-12' : false,
          )}
          {...rest}
        />
        {endAdornment ? <div className="absolute inset-y-0 right-2 grid place-items-center">{endAdornment}</div> : null}
      </div>
      {note ? (
        <p id={noteId} role={error ? 'alert' : undefined} className={cn('text-[12px]', error ? 'text-danger' : 'text-ink-faint')}>
          {note}
        </p>
      ) : null}
    </div>
  );
});
