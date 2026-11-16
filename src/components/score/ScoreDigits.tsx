import { cn } from '../cn';

type Props = {
  value: number;
  size?: 'xl' | 'lg';
  className?: string;
};

/**
 * Monospaced, tabular score numerals (a score must not shift sideways going 9 -> 10).
 * Re-keyed on change so the digit rolls up in 140ms; the value is already in the store by then.
 */
export function ScoreDigits({ value, size = 'xl', className }: Props) {
  return (
    <span
      className={cn(
        'num inline-block overflow-hidden text-center font-bold leading-none',
        size === 'xl' ? 'text-[64px]' : 'text-[36px]',
        // Callers only pass a colour; two colour utilities on one element resolve by stylesheet order.
        className ?? 'text-ink',
      )}
    >
      <span key={value} className="roll">
        {value}
      </span>
    </span>
  );
}
