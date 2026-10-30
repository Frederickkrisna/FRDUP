import type { ScoreInputSpec } from '@/types/sport';

export interface ScoreChange {
  teamIndex: number;
  value: number;
  mode: 'set' | 'delta';
}

/** Pre-translated strings so pads stay free of i18n keys that vary by sport. */
export interface PadLabels {
  increase: (team: string, nextValue: number) => string;
  decrease: (team: string, nextValue: number) => string;
  /** e.g. "Total: 21" */
  total: string;
  deuce: string;
  /** e.g. "Target 21 · menang selisih 2 · maks 30" */
  rule: string;
  sliderLabel: string;
}

export interface PadProps {
  spec: ScoreInputSpec;
  points: number[];
  teamNames: string[];
  winnerTeamIndex: number | null;
  disabled?: boolean;
  labels: PadLabels;
  onChange: (change: ScoreChange) => void;
}
