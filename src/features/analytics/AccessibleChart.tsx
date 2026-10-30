import type { ReactNode } from 'react';

/** One column definition for the visually hidden data table. */
export type A11yColumn = {
  key: string;
  header: string;
};

type Props = {
  /** Accessible title for the figure (already translated). */
  title: string;
  /** One-line summary of the latest value and trend (already translated). */
  summary: string;
  /** Column headers for the hidden data table. */
  columns: A11yColumn[];
  /** Rows of already-formatted cell strings, keyed by column key. */
  rows: Array<Record<string, string>>;
  /** Caption for the hidden table (already translated). */
  tableCaption: string;
  children: ReactNode;
};

/**
 * Wraps a chart in a <figure> with an accessible text summary and a visually hidden
 * <table> mirror of the data, so screen-reader users get the numbers the SVG conveys
 * visually. The SVG itself is aria-hidden — the table is the accessible source of truth.
 */
export function AccessibleChart({ title, summary, columns, rows, tableCaption, children }: Props) {
  return (
    <figure className="m-0" aria-label={title}>
      <p className="sr-only">{summary}</p>
      <div aria-hidden="true">{children}</div>
      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>{row[c.key] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
