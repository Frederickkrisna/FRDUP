import type { TooltipContentProps } from 'recharts';

/** One formatted line inside the tooltip body. */
export type TooltipRow = {
  label: string;
  value: string;
  /** CSS-variable colour string for the swatch. */
  color: string;
};

/**
 * Recharts passes TooltipContentProps when it clones the element given to
 * `content`. We read `active`/`payload`/`label` from there. The caller supplies a
 * mapper that turns the raw datapoints (recovered from payload) into formatted rows,
 * plus a label formatter — so each chart controls its own copy and number formatting.
 */
type Props<T> = Partial<TooltipContentProps> & {
  labelFormatter: (label: string | number) => string;
  rowsFromPayload: (label: string, points: T[]) => TooltipRow[];
};

export function ChartTooltip<T>({ active, payload, label, labelFormatter, rowsFromPayload }: Props<T>) {
  if (!active || !payload || payload.length === 0) return null;

  const points = payload
    .map((entry) => entry.payload as T | undefined)
    .filter((p): p is T => p != null);

  const headline = label != null ? labelFormatter(label) : '';
  const rows = rowsFromPayload(headline, points);
  if (rows.length === 0) return null;

  return (
    <div
      role="presentation"
      className="rounded-md border border-line bg-surface-2 px-3 py-2 shadow-lg"
      style={{ borderColor: 'var(--c-border-strong)' }}
    >
      {headline ? <p className="num mb-1 text-[11px] font-semibold text-ink-muted">{headline}</p> : null}
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2 text-[12px]">
            <span
              aria-hidden="true"
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-ink-muted">{row.label}</span>
            <span className="num ml-auto font-semibold text-ink">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
