/**
 * Client-minted 21-character URL-safe ID (nanoid alphabet).
 * Never use Firestore auto-IDs — offline-first requires local minting.
 * See docs/api_contract.md §1 conventions.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ID_LENGTH = 21;

/**
 * Generates a cryptographically random 21-char URL-safe ID.
 * Works in both Node (Vitest) and React Native (global.crypto or Math.random fallback).
 */
export function createId(): string {
  let id = '';
  const randomValues = new Uint8Array(ID_LENGTH * 2); // oversample to handle modulo bias

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomValues);
  } else {
    // Node < 19 fallback (Vitest environment)
    for (let i = 0; i < randomValues.length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }

  let filled = 0;
  for (let i = 0; i < randomValues.length && filled < ID_LENGTH; i++) {
    const byte = randomValues[i] ?? 0;
    // 256 is an exact multiple of 64, so `byte & 63` is unbiased — no rejection needed.
    id += ALPHABET.charAt(byte & 63);
    filled++;
  }

  return id;
}
