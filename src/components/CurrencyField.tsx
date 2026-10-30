import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { TextField } from './TextField';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  label: string;
  /** Integer rupiah. */
  value: number;
  onValueChange: (value: number) => void;
  hint?: string;
  error?: string | null;
  prefixLabel?: string;
};

const GROUP = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const MAX = 999_999_999;

/** Masked integer currency field. The model value is always integer rupiah — no floats. */
export const CurrencyField = forwardRef<HTMLInputElement, Props>(function CurrencyField(
  { value, onValueChange, prefixLabel = 'Rp', ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const shown = value === 0 && focused ? '' : GROUP.format(value);
  return (
    <TextField
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={shown}
      placeholder="0"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
        onValueChange(Math.min(MAX, digits === '' ? 0 : Number.parseInt(digits, 10)));
      }}
      endAdornment={<span className="num pr-2 text-[13px] text-ink-faint">{prefixLabel}</span>}
      {...rest}
    />
  );
});
