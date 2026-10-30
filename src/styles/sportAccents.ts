import type { SportId } from '@/types/sport';

/** Sport tint + icon lookup. See docs/design.md §2.4. */
export const sportAccents: Record<SportId, { accentColor: string; icon: string }> = {
  padel: { accentColor: '#2DD4BF', icon: 'circle-dot' },
  badminton: { accentColor: '#60A5FA', icon: 'feather' },
  pingpong: { accentColor: '#FB923C', icon: 'circle' },
  billiard: { accentColor: '#4ADE80', icon: 'target' },
  mahjong: { accentColor: '#F87171', icon: 'grid-3x3' },
};
