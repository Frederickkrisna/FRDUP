/**
 * Integer rupiah formatting. All currency in FRDUP is integer IDR.
 * Never format money with floating-point arithmetic — see CLAUDE.md §6.
 *
 * formatIdr(12500) → "Rp 12.500"
 * formatIdr(1000000) → "Rp 1.000.000"
 */

/**
 * Formats an integer rupiah value for display.
 * Uses Indonesian thousand-separator (period), no decimal places.
 *
 * @param rupiah - Integer rupiah amount
 * @param compact - If true, abbreviates large amounts: 450000 → "450 rb", 1500000 → "1,5 jt"
 */
export function formatIdr(rupiah: number, compact = false): string {
  if (compact) {
    const abs = Math.abs(rupiah);
    const sign = rupiah < 0 ? '-' : '';
    if (abs >= 1_000_000) {
      const jt = abs / 1_000_000;
      // Show one decimal only if it's meaningful
      const display = jt % 1 === 0 ? `${jt}` : jt.toFixed(1).replace('.', ',');
      return `${sign}Rp ${display} jt`;
    }
    if (abs >= 1_000) {
      const rb = abs / 1_000;
      const display = rb % 1 === 0 ? `${rb}` : rb.toFixed(1).replace('.', ',');
      return `${sign}Rp ${display} rb`;
    }
    return `${sign}Rp ${abs}`;
  }

  // Full format: period-separated thousands, e.g. "Rp 1.250.000"
  const formatted = Math.abs(rupiah)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return rupiah < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Rounds an integer rupiah value to the nearest granularity.
 * granularity: 100 | 500 | 1000
 */
export function roundIdr(rupiah: number, granularity: number): number {
  return Math.round(rupiah / granularity) * granularity;
}

/**
 * Round half-up (round towards +∞ on .5).
 * Used by the billing engine for settlement rounding.
 */
export function roundHalfUp(value: number, granularity: number): number {
  return Math.floor((value + granularity / 2) / granularity) * granularity;
}
