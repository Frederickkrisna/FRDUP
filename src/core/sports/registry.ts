/**
 * Sport plugin registry.
 * Adding a sport = implement SportPlugin in src/core/sports/<id>.ts + add one line here.
 * No other file in the codebase should be touched. See docs/implementation_fe.md §5.
 */

import type { SportId, SportPlugin } from '@/types/sport';
import { padelPlugin } from './padel';
import { badmintonPlugin } from './badminton';
import { pingpongPlugin } from './pingpong';
import { billiardPlugin } from './billiard';
import { mahjongPlugin } from './mahjong';

export const SPORT_REGISTRY: Readonly<Record<SportId, SportPlugin>> = {
  padel: padelPlugin,
  badminton: badmintonPlugin,
  pingpong: pingpongPlugin,
  billiard: billiardPlugin,
  mahjong: mahjongPlugin,
};

export class UnknownSportError extends Error {
  constructor(id: string) {
    super(`Unknown sport: "${id}". Register it in src/core/sports/registry.ts.`);
    this.name = 'UnknownSportError';
  }
}

/** Returns the plugin for the given sport id. Throws UnknownSportError if not found. */
export function getSportPlugin(id: SportId): SportPlugin {
  const plugin = SPORT_REGISTRY[id];
  if (!plugin) throw new UnknownSportError(id);
  return plugin;
}

/** Returns all registered plugins in a stable display order. */
export function listSports(): SportPlugin[] {
  return [padelPlugin, badmintonPlugin, pingpongPlugin, billiardPlugin, mahjongPlugin];
}
