import { describe, expect, it } from 'vitest';
import { exportFilename } from './filename';
import {
  computeLayout,
  displayName,
  podiumDisplayOrder,
  podiumHeights,
  rowCapFor,
  truncateName,
} from './layout';
import type { CardEntry } from './types';

function entry(rank: number, name: string): CardEntry {
  return {
    playerId: `p${rank}`,
    rank,
    name,
    nickname: null,
    initials: 'XX',
    avatarColor: 'hsl(0 0% 50%)',
    primaryValue: String(100 - rank),
    secondary: '0M · 0K · +0',
    tier: null,
    rpDelta: null,
  };
}

function entries(count: number): CardEntry[] {
  return Array.from({ length: count }, (_, i) => entry(i + 1, `Player ${i + 1}`));
}

describe('exportFilename', () => {
  it('builds a feed filename from an ISO date', () => {
    expect(exportFilename('session', 'badminton', '2026-09-12', 'feed')).toBe('frdup-badminton-2026-09-12-feed.png');
  });

  it('builds a story filename', () => {
    expect(exportFilename('alltime', 'padel', '2026-01-01', 'story')).toBe('frdup-padel-2026-01-01-story.png');
  });

  it('marks tier-up cards', () => {
    expect(exportFilename('tierup', 'padel', '2026-09-12', 'feed')).toBe('frdup-tierup-padel-2026-09-12-feed.png');
  });

  it('parses a leading ISO portion out of a longer string', () => {
    expect(exportFilename('session', 'mahjong', '2026-09-12T10:00:00+07:00', 'feed')).toBe('frdup-mahjong-2026-09-12-feed.png');
  });

  it('falls back to "undated" for an unparseable date', () => {
    expect(exportFilename('session', 'billiard', 'tanggal tidak diketahui', 'feed')).toBe('frdup-billiard-undated-feed.png');
  });

  it('parses a human-readable date that Date can still understand', () => {
    expect(exportFilename('session', 'billiard', '12 Sep 2026', 'feed')).toBe('frdup-billiard-2026-09-12-feed.png');
  });
});

describe('truncateName', () => {
  it('leaves a short name unchanged', () => {
    expect(truncateName('Sari', 16)).toBe('Sari');
  });

  it('leaves a one-letter name unchanged', () => {
    expect(truncateName('A', 16)).toBe('A');
  });

  it('truncates a long name with an ellipsis and never exceeds max glyphs', () => {
    const out = truncateName('Budi Santoso Wijaya Kusuma Negoro', 12);
    expect(out.endsWith('\u2026')).toBe(true);
    expect(Array.from(out).length).toBeLessThanOrEqual(12);
  });

  it('does not split a non-Latin glyph', () => {
    const out = truncateName('Æsir Þórsson', 5);
    expect(Array.from(out).length).toBeLessThanOrEqual(5);
    expect(out.endsWith('\u2026')).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(truncateName('  Dewi  ', 16)).toBe('Dewi');
  });
});

describe('displayName', () => {
  it('prefers a non-empty nickname', () => {
    expect(displayName({ name: 'Rizky Pratama', nickname: 'Riz' })).toBe('Riz');
  });

  it('falls back to the full name when nickname is empty or null', () => {
    expect(displayName({ name: 'Rizky Pratama', nickname: '  ' })).toBe('Rizky Pratama');
    expect(displayName({ name: 'Rizky Pratama', nickname: null })).toBe('Rizky Pratama');
  });
});

describe('podiumDisplayOrder', () => {
  it('orders second, first, third', () => {
    const order = podiumDisplayOrder(entries(3));
    expect(order.map((e) => e.rank)).toEqual([2, 1, 3]);
  });

  it('handles a single entry', () => {
    const order = podiumDisplayOrder(entries(1));
    expect(order.map((e) => e.rank)).toEqual([1]);
  });

  it('handles two entries (no third column)', () => {
    const order = podiumDisplayOrder(entries(2));
    expect(order.map((e) => e.rank)).toEqual([2, 1]);
  });
});

describe('podiumHeights', () => {
  it('gives the leader the full height and others zero when alone', () => {
    expect(podiumHeights(1)).toEqual({ first: 1, second: 0, third: 0 });
  });

  it('drops the third column when only two are present', () => {
    expect(podiumHeights(2).third).toBe(0);
    expect(podiumHeights(2).second).toBeGreaterThan(0);
  });

  it('descends 1 > 2 > 3 with three present', () => {
    const h = podiumHeights(3);
    expect(h.first).toBeGreaterThan(h.second);
    expect(h.second).toBeGreaterThan(h.third);
  });
});

describe('computeLayout', () => {
  it('returns an empty-but-valid layout with no entries', () => {
    const layout = computeLayout([], 'court', 'feed');
    expect(layout.hasPodium).toBe(false);
    expect(layout.leader).toBeNull();
    expect(layout.podium).toEqual([]);
    expect(layout.rows).toEqual([]);
    expect(layout.overflow).toBe(0);
  });

  it('puts up to three in the podium and the rest in rows', () => {
    const layout = computeLayout(entries(9), 'court', 'feed');
    expect(layout.podium.length).toBe(3);
    expect(layout.rows.length).toBe(6);
    expect(layout.overflow).toBe(0);
  });

  it('caps rows per template/format and reports overflow', () => {
    const layout = computeLayout(entries(25), 'court', 'feed');
    const cap = rowCapFor('court', 'feed');
    expect(layout.rows.length).toBe(cap);
    expect(layout.overflow).toBe(25 - 3 - cap);
  });

  it('story fits more rows than feed for the same template', () => {
    expect(rowCapFor('court', 'story')).toBeGreaterThan(rowCapFor('court', 'feed'));
    const feed = computeLayout(entries(25), 'court', 'feed');
    const story = computeLayout(entries(25), 'court', 'story');
    expect(story.rows.length).toBeGreaterThan(feed.rows.length);
  });

  it('degrades for one and two entries', () => {
    const one = computeLayout(entries(1), 'night', 'feed');
    expect(one.podium.length).toBe(1);
    expect(one.rows.length).toBe(0);
    const two = computeLayout(entries(2), 'night', 'feed');
    expect(two.podium.length).toBe(2);
    expect(two.rows.length).toBe(0);
  });
});
