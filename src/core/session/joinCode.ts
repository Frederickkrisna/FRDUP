/**
 * Join code: 6 characters from a 32-symbol alphabet with ambiguous glyphs removed (no O/0/I/1).
 * See docs/implementation_be.md §4.1. The code is a bearer credential with a short TTL.
 */

export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;
export const JOIN_CODE_TTL_MS = 4 * 60 * 60 * 1000;

/** `random` must return 32 random bits per call in [0, 2^32). Injected so the core stays pure. */
export function generateJoinCode(random: () => number): string {
  let out = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    out += JOIN_CODE_ALPHABET.charAt(random() % JOIN_CODE_ALPHABET.length);
  }
  return out;
}

/** Uppercases and strips separators/whitespace so pasted codes ("abc-234") still resolve. */
export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidJoinCode(code: string): boolean {
  if (code.length !== JOIN_CODE_LENGTH) return false;
  for (const ch of code) if (!JOIN_CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/** Extracts a code from a pasted value: a bare code, or a /join/CODE link. */
export function extractJoinCode(input: string): string | null {
  const fromLink = /\/join\/([A-Za-z0-9-]{6,12})/.exec(input);
  const candidate = normalizeJoinCode(fromLink?.[1] ?? input);
  return isValidJoinCode(candidate) ? candidate : null;
}

export function isJoinCodeLive(expiresAt: number | null, now: number): boolean {
  return expiresAt !== null && expiresAt > now;
}
