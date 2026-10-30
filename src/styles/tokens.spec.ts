import { describe, expect, it } from 'vitest';

import { colors } from './tokens';
import { contrastRatio, WCAG_AA_LARGE, WCAG_AA_NORMAL } from './contrast';

describe('token contrast — design.md §2.5', () => {
  it.each([
    ['text on bg', colors.text, colors.bg, WCAG_AA_NORMAL],
    ['text on surface', colors.text, colors.surface, WCAG_AA_NORMAL],
    ['text on surface-2', colors.text, colors.surface2, WCAG_AA_NORMAL],
    ['text-muted on bg', colors.textMuted, colors.bg, WCAG_AA_NORMAL],
    ['text-muted on surface', colors.textMuted, colors.surface, WCAG_AA_NORMAL],
    ['primary-on on primary (large text / icons)', colors.primaryOn, colors.primary, WCAG_AA_LARGE],
    ['success-on on success', colors.successOn, colors.success, WCAG_AA_LARGE],
    ['danger-on on danger', colors.dangerOn, colors.danger, WCAG_AA_LARGE],
    ['warning-on on warning', colors.warningOn, colors.warning, WCAG_AA_LARGE],
    ['info-on on info', colors.infoOn, colors.info, WCAG_AA_LARGE],
  ])('%s meets its WCAG threshold', (_label, fg, bg, minRatio) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minRatio);
  });
});
