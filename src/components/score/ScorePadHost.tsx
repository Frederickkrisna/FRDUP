import { FixedSumPad } from './FixedSumPad';
import { IncrementPad } from './IncrementPad';
import { RaceToNPad } from './RaceToNPad';
import type { PadProps } from './types';

const PADS = {
  fixed_sum: FixedSumPad,
  race_to_n: RaceToNPad,
  simple_increment: IncrementPad,
} as const;

/**
 * Picks the pad from the plugin's input type — never from the sport id.
 * Adding a sport never touches this file (docs/implementation_fe.md §5).
 */
export function ScorePadHost(props: PadProps) {
  const Pad = PADS[props.spec.type];
  return <Pad {...props} />;
}
