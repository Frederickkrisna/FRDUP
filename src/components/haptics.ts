/**
 * Haptics via the Vibration API. Feature-detected: iOS Safari has no Vibration API, so every call
 * is a silent no-op there and the UI compensates with visible feedback (digit roll, border flash).
 */

type Pattern = 'tap' | 'success' | 'warning' | 'medium' | 'heavy';

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  medium: 16,
  heavy: 30,
  success: [14, 40, 14],
  warning: [24, 50, 24],
};

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export const hapticsSupported: boolean = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function haptic(kind: Pattern): void {
  if (!enabled || !hapticsSupported) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw when called without a recent user gesture; haptics are best-effort.
  }
}
