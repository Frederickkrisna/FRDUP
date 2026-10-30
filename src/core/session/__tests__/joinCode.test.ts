import { describe, expect, it } from 'vitest';
import {
  JOIN_CODE_ALPHABET,
  extractJoinCode,
  generateJoinCode,
  isJoinCodeLive,
  isValidJoinCode,
  normalizeJoinCode,
} from '../joinCode';

describe('joinCode', () => {
  it('alphabet has 32 unambiguous symbols', () => {
    expect(JOIN_CODE_ALPHABET).toHaveLength(32);
    for (const bad of ['O', '0', 'I', '1']) expect(JOIN_CODE_ALPHABET).not.toContain(bad);
  });

  it('generates 6 valid characters, deterministic for a given source', () => {
    let n = 0;
    const src = () => (n += 7919);
    const a = generateJoinCode(src);
    n = 0;
    const b = generateJoinCode(src);
    expect(a).toBe(b);
    expect(isValidJoinCode(a)).toBe(true);
  });

  it('every output char is in the alphabet across many draws', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateJoinCode(() => Math.floor(Math.random() * 2 ** 32));
      expect(isValidJoinCode(code)).toBe(true);
    }
  });

  it('normalizes pasted input', () => {
    expect(normalizeJoinCode(' abc-234 ')).toBe('ABC234');
  });

  it('extracts codes from bare input and links', () => {
    expect(extractJoinCode('abc234')).toBe('ABC234');
    expect(extractJoinCode('https://frdup.app/join/abc234?x=1')).toBe('ABC234');
    expect(extractJoinCode('ABC OOO')).toBeNull();
    expect(extractJoinCode('short')).toBeNull();
  });

  it('expiry', () => {
    expect(isJoinCodeLive(1000, 999)).toBe(true);
    expect(isJoinCodeLive(1000, 1000)).toBe(false);
    expect(isJoinCodeLive(null, 0)).toBe(false);
  });
});
