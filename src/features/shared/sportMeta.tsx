import { CircleDot, Circle, Feather, Grid3x3, Target, type LucideProps } from 'lucide-react';
import { listSports } from '@/core/sports/registry';
import type { SportId } from '@/types/sport';

const ICONS = {
  'circle-dot': CircleDot,
  feather: Feather,
  circle: Circle,
  target: Target,
  'grid-3x3': Grid3x3,
} as const;

/** CSS colour reference for a sport accent (declared in tokens.css). */
export function sportAccent(sportId: SportId): string {
  return `var(--sport-${sportId})`;
}

export function allSports() {
  return listSports();
}

/** Renders the plugin's lucide icon by name (a lookup in a module-level table, not a dynamic component). */
export function SportIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = (ICONS as Record<string, typeof Circle>)[name] ?? Circle;
  return <Icon {...props} />;
}
