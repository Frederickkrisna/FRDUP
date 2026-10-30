/**
 * Date helpers for FRDUP. All rendering is in Asia/Jakarta.
 * Domain code works in epoch millis; only format at the render edge.
 * See CLAUDE.md §6 (Dates convention).
 */

const JAKARTA_TZ = 'Asia/Jakarta';

/** Returns current time as epoch millis. */
export function nowMs(): number {
  return Date.now();
}

/** Format epoch millis to a display string in Asia/Jakarta. */
export function formatDate(millis: number, locale: 'id' | 'en' = 'id'): string {
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    timeZone: JAKARTA_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(millis));
}

/** Format epoch millis to a short date, e.g. "12 Sep 2026". */
export function formatDateShort(millis: number, locale: 'id' | 'en' = 'id'): string {
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    timeZone: JAKARTA_TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(millis));
}

/** Format epoch millis to a day-of-week + date, e.g. "Jumat, 12 Sep 2026". */
export function formatDateWithDay(millis: number, locale: 'id' | 'en' = 'id'): string {
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    timeZone: JAKARTA_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(millis));
}

/** Format epoch millis to time only, e.g. "19:30". */
export function formatTime(millis: number): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(millis));
}

/** Returns 'YYYY-MM-DD' in Asia/Jakarta. Used for streak computation. */
export function toIsoDate(millis: number): string {
  const d = new Date(millis);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

/**
 * Returns elapsed duration as a human-readable string, e.g. "1 j 23 m".
 * Used on the resume banner and session header.
 */
export function formatElapsed(startMillis: number, nowMillis: number = Date.now()): string {
  const diffMs = Math.max(0, nowMillis - startMillis);
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} m`;
  return `${hours} j ${minutes} m`;
}

/**
 * Checks if two millis timestamps are within the weekly attendance window
 * (±3 day tolerance around a 7-day cadence). Used for streak computation.
 */
export function isWithinWeeklyWindow(prevMillis: number, nextMillis: number): boolean {
  const diffDays = (nextMillis - prevMillis) / 86_400_000;
  return diffDays >= 4 && diffDays <= 10;
}
