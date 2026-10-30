/**
 * Deterministic PRNG — mulberry32.
 * Same seed ⇒ byte-identical output every time.
 * See docs/implementation_be.md §6.2.5.
 */

export interface SeededRng {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns a random integer in [0, max). */
  nextInt(max: number): number;
  /** Returns a random integer in [min, max). */
  nextIntRange(min: number, max: number): number;
  /** Picks a random element from an array. */
  pick<T>(arr: readonly T[]): T;
  /** Returns a small jitter float for tie-breaking (in [0, epsilon)). */
  jitter(): number;
}

/** Creates a mulberry32 PRNG seeded with the given 32-bit seed. */
export function seededRandom(seed: number): SeededRng {
  let s = seed >>> 0; // ensure 32-bit unsigned

  function next(): number {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    return z / 0x100000000;
  }

  return {
    next,
    nextInt(max) {
      return Math.floor(next() * max);
    },
    nextIntRange(min, max) {
      return min + Math.floor(next() * (max - min));
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('seededRandom.pick: empty array');
      return arr[Math.floor(next() * arr.length)] as T;
    },
    jitter() {
      return next() * 1e-6;
    },
  };
}

/** Fisher-Yates shuffle in-place using the given RNG. Returns the array for chaining. */
export function shuffle<T>(arr: T[], rng: SeededRng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}
