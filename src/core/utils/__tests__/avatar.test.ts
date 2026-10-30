import { describe, expect, it } from 'vitest';
import { AVATAR_PALETTE, avatarColorFor, initialsOf, parseBulkNames } from '../avatar';

describe('avatar helpers', () => {
  it('color is deterministic, case/space-insensitive and from the palette', () => {
    expect(avatarColorFor('Rizky')).toBe(avatarColorFor('  rizky '));
    expect(AVATAR_PALETTE).toContain(avatarColorFor('Sari') as (typeof AVATAR_PALETTE)[number]);
  });

  it('initials', () => {
    expect(initialsOf('Rizky Pratama')).toBe('RP');
    expect(initialsOf('budi')).toBe('B');
    expect(initialsOf('Ahmad Budi Santoso')).toBe('AS');
    expect(initialsOf('  ')).toBe('?');
  });

  it('parses pasted WhatsApp lists', () => {
    const raw = '1. Rizky\n2) Sari\n- Budi\n• Dewi, Andi;  tono \n\nrizky\n';
    expect(parseBulkNames(raw)).toEqual(['Rizky', 'Sari', 'Budi', 'Dewi', 'Andi', 'tono']);
  });

  it('caps very long names and ignores blanks', () => {
    expect(parseBulkNames('x'.repeat(100))[0]).toHaveLength(40);
    expect(parseBulkNames(' \n , ; ')).toEqual([]);
  });
});
