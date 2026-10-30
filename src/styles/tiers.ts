import type { TierKey } from '@/types/rank';

/** Tier visual language — the only place these hexes may appear. See docs/design.md §2.3. */
export const tiers: Record<TierKey, { solid: string; gradient: [string, string]; animatedSheen: boolean }> = {
  warrior: { solid: '#B07C4F', gradient: ['#8A5C34', '#D4A574'], animatedSheen: false },
  elite: { solid: '#8FB3CE', gradient: ['#5D7F99', '#C3DCF0'], animatedSheen: false },
  master: { solid: '#3FC5B0', gradient: ['#1E8C7C', '#6FE8D4'], animatedSheen: false },
  grandmaster: { solid: '#5B8CFF', gradient: ['#2E5BD4', '#8FB2FF'], animatedSheen: false },
  epic: { solid: '#B06BF5', gradient: ['#7C3AC9', '#D8A5FF'], animatedSheen: false },
  legend: { solid: '#F7B33D', gradient: ['#C98410', '#FFD98A'], animatedSheen: false },
  mythic: { solid: '#FF4D6D', gradient: ['#D01B45', '#FF8FA8'], animatedSheen: true },
};

export const TIER_ORDER: TierKey[] = ['warrior', 'elite', 'master', 'grandmaster', 'epic', 'legend', 'mythic'];
