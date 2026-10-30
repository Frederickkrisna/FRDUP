/**
 * Instagram / WhatsApp image export — the shared contract between the screens (src/routes) and the
 * export module. Screens build these data objects; the export module renders and shares them.
 * Dimensions are fixed so the result is identical on Android Chrome and iOS Safari.
 */

import type { Id } from '@/types/common';
import type { SportId } from '@/types/sport';
import type { TierKey } from '@/types/rank';

export type CardFormat = 'feed' | 'story';

/** Pixel size of the exported PNG (device-independent: rendered off-screen at exactly this size). */
export const CARD_SIZE: Record<CardFormat, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 }, // Instagram feed 4:5
  story: { width: 1080, height: 1920 }, // Instagram story 9:16
};

/** Visual templates. Three genuinely different art directions, not three colour swaps. */
export type CardTemplateId = 'court' | 'night' | 'paper';

export interface CardEntry {
  playerId: Id;
  rank: number;
  name: string;
  /** Short display name; falls back to `name`. */
  nickname?: string | null;
  initials: string;
  avatarColor: string;
  /** Primary metric shown big (points for padel, wins elsewhere). Already formatted. */
  primaryValue: string;
  /** Secondary line, already formatted, e.g. "7M · 2K · +18". */
  secondary: string;
  tier: { key: TierKey; division: number; stars: number } | null;
  /** RP change this session (session cards only). */
  rpDelta?: number | null;
}

export interface LeaderboardCardData {
  kind: 'session' | 'alltime';
  sportId: SportId;
  /** Localised sport name, e.g. "Badminton". */
  sportName: string;
  /** Session title, or the all-time heading. */
  title: string;
  /** Venue and/or details line; optional. */
  subtitle?: string | null;
  /** Pre-formatted date (Asia/Jakarta), e.g. "Jumat, 12 Sep 2026". */
  dateLabel: string;
  /** ISO date (YYYY-MM-DD, Asia/Jakarta) used for file names. */
  dateIso?: string;
  /** Ordered by rank ascending; the card shows the podium + up to 7 more rows. */
  entries: CardEntry[];
  totalPlayers: number;
  /** e.g. "8 ronde · 9 pemain" — already localised. */
  metaLine: string;
  /** Localised captions used on the card itself. */
  captions: {
    podium: string;
    rpUnit: string;
    brand: string; // "FRDUP"
    madeWith: string; // subtle watermark phrase
  };
}

/** Single-player tier-up share card. */
export interface TierUpCardData {
  sportId: SportId;
  sportName: string;
  playerName: string;
  initials: string;
  avatarColor: string;
  from: { key: TierKey; division: number };
  to: { key: TierKey; division: number; stars: number };
  tierName: string;
  headline: string; // "Naik tier" — localised
  rpLabel: string; // "1.250 RP"
  dateLabel: string;
  dateIso?: string;
  captions: { brand: string; madeWith: string };
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export interface RenderedCard {
  blob: Blob;
  /** Object URL for previews; the caller must revoke it. */
  url: string;
  width: number;
  height: number;
}
