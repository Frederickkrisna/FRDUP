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
  /** Fixed-sum grid: caption naming the side a tapped number goes to. */
  pickFor: (team: string) => string;
  /** Fixed-sum grid: accessible name of one number key. */
  setScore: (team: string, value: number) => string;
}

export interface PadProps {
  spec: ScoreInputSpec;
  points: number[];
  teamNames: string[];
  winnerTeamIndex: number | null;
  disabled?: boolean;
  labels: PadLabels;
  onChange: (change: ScoreChange) => void;
  /** A tap that is a whole final score (fixed-sum grid): the host saves, completes and closes. */
  onSubmit?: (change: ScoreChange) => void;
}
