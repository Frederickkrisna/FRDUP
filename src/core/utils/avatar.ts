/** Deterministic avatar swatch + initials. Pure, so roster, export cards and tests agree. */

/** Muted, dark-surface-friendly swatches; each pairs with near-black text at AA contrast. */
export const AVATAR_PALETTE = [
  '#7DD3C0',
  '#9DB8FF',
  '#F2B8A0',
  '#C9A7F5',
  '#E8D27A',
  '#8FD694',
  '#F29AB0',
  '#7CC4E8',
] as const;

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function avatarColorFor(seed: string): string {
  return AVATAR_PALETTE[hash(seed.trim().toLowerCase()) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0];
}

/** "Rizky Pratama" -> "RP", "budi" -> "B", "" -> "?" */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase();
}

/** One name per line / comma separated, as pasted from a WhatsApp message. Dedupes case-insensitively. */
export function parseBulkNames(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[\n\r,;]+/)) {
    const name = piece
      .replace(/^[\s\-*•\d.)(]+/, '') // list markers: "1.", "- ", "• "
      .replace(/\s+/g, ' ')
      .trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name.slice(0, 40));
  }
  return out;
}
