import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TierKey } from '@/types/rank';
import { cn } from './cn';

export type BadgeSize = 'sm' | 'md' | 'lg' | 'hero';

const WIDTH: Record<BadgeSize, number> = { sm: 32, md: 48, lg: 80, hero: 144 };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

type Props = {
  tier: TierKey;
  /** 1 = top division. 0 for Mythic (no divisions). */
  division: number;
  size?: BadgeSize;
  /** Filled stars in the current division (0..starsPerDivision-1), announced to screen readers. */
  stars?: number;
  className?: string;
};

/**
 * Shield badge. Tier is never colour-only: the tier name is in the accessible label, the division
 * is a numeral inside the shield. Mythic is the only badge with motion (a slow sheen, off when
 * the user prefers reduced motion).
 */
export function TierBadge({ tier, division, size = 'md', stars, className }: Props) {
  const { t } = useTranslation();
  const uid = useId().replace(/:/g, '');
  const w = WIDTH[size];
  const mythic = tier === 'mythic';
  const label = [
    t(`rank.tier.${tier}`),
    mythic ? null : t('rank.division', { number: division }),
    stars !== undefined && !mythic ? t('rank.stars', { count: stars }) : null,
  ]
    .filter(Boolean)
    .join(', ');
  const grad = `${uid}-g`;
  const clip = `${uid}-c`;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 80 96"
      width={w}
      height={(w * 96) / 80}
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: `var(--tier-${tier}-to)` }} />
          <stop offset="1" style={{ stopColor: `var(--tier-${tier}-from)` }} />
        </linearGradient>
        <clipPath id={clip}>
          <path d="M40 4 74 16v32c0 22-16 38-34 44C22 86 6 70 6 48V16z" />
        </clipPath>
      </defs>
      <path d="M40 4 74 16v32c0 22-16 38-34 44C22 86 6 70 6 48V16z" fill={`url(#${grad})`} />
      <path d="M40 10 68 20v28c0 18-13 32-28 38C25 80 12 66 12 48V20z" fill="none" style={{ stroke: `var(--tier-${tier}-to)` }} strokeOpacity="0.7" strokeWidth="1.5" />
      <path d="M40 4 74 16v14L40 20 6 30V16z" fill="var(--c-text)" fillOpacity="0.14" clipPath={`url(#${clip})`} />
      {mythic ? (
        <>
          <path d="M26 54l4-16 10 8 10-8 4 16z" fill="var(--c-bg)" fillOpacity="0.88" />
          <g clipPath={`url(#${clip})`}>
            <rect className="sheen" x="0" y="0" width="22" height="96" fill="var(--c-text)" fillOpacity="0.38" style={{ transformBox: 'fill-box' }} />
          </g>
        </>
      ) : (
        <text
          x="40"
          y="58"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          fontSize={division >= 4 ? 28 : 34}
          fill="var(--c-bg)"
          fillOpacity="0.88"
        >
          {ROMAN[division] ?? String(division)}
        </text>
      )}
    </svg>
  );
}
