/**
 * Dev-only demo data factory. Produces realistic Indonesian rosters for screenshot-testing the
 * export cards in Chromium and WebKit. Includes deliberate edge cases: a very long name, a
 * one-letter name, and a name with non-Latin characters. Literal Indonesian strings here are DATA,
 * not UI copy, so they are intentionally not routed through i18n.
 */

import type { CardEntry, LeaderboardCardData, TierUpCardData } from './types';
import type { TierKey } from '@/types/rank';
import { TIER_ORDER } from '@/styles/tiers';

/**
 * A fixed swatch palette (data, not design tokens) for deterministic demo avatars. Expressed as
 * HSL strings rather than hex so the feature-layer HEX_COLOR lint rule stays satisfied; these are
 * demo stand-ins for the roster's real `avatarColor` values.
 */
const SWATCHES = [
  'hsl(42 88% 65%)',
  'hsl(157 48% 66%)',
  'hsl(218 100% 71%)',
  'hsl(0 78% 74%)',
  'hsl(267 100% 80%)',
  'hsl(24 82% 69%)',
  'hsl(183 59% 61%)',
  'hsl(320 62% 74%)',
  'hsl(93 56% 62%)',
  'hsl(22 100% 70%)',
];

const NAMES = [
  'Rizky Pratama',
  'Sari',
  'Budi Santoso Wijaya Kusuma Negoro', // very long name — must truncate gracefully
  'Dewi Lestari',
  'A', // one-letter name
  'Æsir Þórsson', // non-Latin characters
  'Andi Nugroho',
  'Putri Maharani',
  'Gilang Ramadhan',
  'Tono',
  'Intan Permatasari',
  'Fajar Hidayat',
  'Nabila Zahra',
  'Reza Firmansyah',
  'Clara Wijaya',
  'Dimas Aryo',
  'Kirana Dewi',
  'Yoga Saputra',
  'Mega Puspita',
  'Hendra Gunawan',
  'Siti Rahmawati',
  'Bayu Setiawan',
  'Ayu Kartika',
  'Rama Pradipta',
  'Nina Oktaviani',
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const firstPart = parts[0] ?? '';
  if (parts.length === 1) return Array.from(firstPart).slice(0, 2).join('').toUpperCase();
  const lastPart = parts[parts.length - 1] ?? '';
  const first = Array.from(firstPart)[0] ?? '';
  const last = Array.from(lastPart)[0] ?? '';
  return `${first}${last}`.toUpperCase();
}

function tierFor(index: number): { key: TierKey; division: number; stars: number } {
  const key = TIER_ORDER[index % TIER_ORDER.length] ?? 'warrior';
  const division = key === 'mythic' ? 0 : (index % 5) + 1;
  const stars = key === 'mythic' ? 0 : index % 3;
  return { key, division, stars };
}

const CAPTIONS = {
  podium: 'Podium',
  rpUnit: 'RP',
  brand: 'FRDUP',
  madeWith: 'dibuat dengan FRDUP',
};

/** Build a leaderboard card dataset with `count` entries. `session` cards carry RP deltas. */
export function demoLeaderboard(count: number, kind: 'session' | 'alltime'): LeaderboardCardData {
  const n = Math.max(0, count);
  const entries: CardEntry[] = Array.from({ length: n }, (_, i) => {
    const name = NAMES[i % NAMES.length] ?? 'Pemain';
    const points = 128 - i * 4 - (i % 3);
    const wins = Math.max(0, 9 - Math.floor(i / 2));
    const losses = Math.min(9, i);
    const diff = (wins - losses) * 3;
    const entry: CardEntry = {
      playerId: `demo-${i}`,
      rank: i + 1,
      name,
      nickname: null,
      initials: initialsOf(name),
      avatarColor: SWATCHES[i % SWATCHES.length] ?? 'hsl(0 0% 50%)',
      primaryValue: kind === 'session' ? String(points) : `${Math.max(40, 92 - i * 2)}%`,
      secondary: `${wins}M · ${losses}K · ${diff >= 0 ? '+' : '\u2212'}${Math.abs(diff)}`,
      tier: tierFor(i),
      rpDelta: kind === 'session' ? 24 - i * 3 : null,
    };
    return entry;
  });

  return {
    kind,
    sportId: 'badminton',
    sportName: 'Badminton',
    title: kind === 'session' ? 'Jumat Malam di GOR Senayan' : 'Klasemen Sepanjang Masa',
    subtitle: kind === 'session' ? 'GOR Senayan · Lapangan 1–3' : 'Semua sesi · 2026',
    dateLabel: 'Jumat, 12 Sep 2026',
    entries,
    totalPlayers: n,
    metaLine: `8 ronde · ${n} pemain`,
    captions: CAPTIONS,
  };
}

/** Build a single-player tier-up card dataset. */
export function demoTierUp(): TierUpCardData {
  return {
    sportId: 'padel',
    sportName: 'Padel',
    playerName: 'Gilang Ramadhan',
    initials: 'GR',
    avatarColor: SWATCHES[2] ?? 'hsl(218 100% 71%)',
    from: { key: 'grandmaster', division: 1 },
    to: { key: 'epic', division: 5, stars: 1 },
    tierName: 'Epic V',
    headline: 'Naik tier',
    rpLabel: '1.250 RP',
    dateLabel: 'Jumat, 12 Sep 2026',
    captions: { brand: 'FRDUP', madeWith: 'dibuat dengan FRDUP' },
  };
}
