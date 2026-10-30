import { useTranslation } from 'react-i18next';
import { TierBadge } from '@/components/TierBadge';
import type { CardEntry } from './types';
import type { CardTheme } from './cardTheme';
import { tierSolidVar } from './cardTheme';
import { displayName, truncateName } from './layout';

/**
 * Shared, presentational building blocks for the three leaderboard templates. These take a resolved
 * `CardTheme` (CSS-variable strings) plus data and render — no business logic, no hex literals.
 */

/** Round initials swatch. Uses the entry's own `avatarColor` (data, not a literal). */
export function InitialsAvatar({
  entry,
  size,
  ring,
}: {
  entry: Pick<CardEntry, 'initials' | 'avatarColor' | 'name'>;
  size: number;
  ring?: string;
}) {
  return (
    <span
      role="img"
      aria-label={entry.name}
      style={{
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '999px',
        backgroundColor: entry.avatarColor,
        color: 'var(--c-primary-on)',
        fontWeight: 800,
        fontSize: Math.round(size * 0.4),
        lineHeight: 1,
        flex: '0 0 auto',
        boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
      }}
    >
      {entry.initials}
    </span>
  );
}

/** Small tier label chip used on list rows (podium uses the full TierBadge shield). */
export function TierChip({ entry, theme }: { entry: CardEntry; theme: CardTheme }) {
  const { t } = useTranslation();
  if (!entry.tier) return null;
  const solid = tierSolidVar(entry.tier.key);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: '999px',
        border: `1px solid ${theme.hair}`,
        color: theme.ink,
        fontSize: 22,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: '999px', backgroundColor: solid, flex: '0 0 auto' }} />
      {t(`rank.tier.${entry.tier.key}`)}
    </span>
  );
}

/** RP delta chip for session cards (green up / red down), colour never the only signal. */
export function RpDeltaChip({ delta, unit, theme }: { delta: number; unit: string; theme: CardTheme }) {
  const up = delta >= 0;
  const color = up ? 'var(--c-success)' : 'var(--c-danger)';
  const sign = up ? '+' : '\u2212';
  return (
    <span
      className="frdup-export-num"
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        color,
        fontSize: 24,
        fontWeight: 700,
      }}
    >
      {sign}
      {Math.abs(delta)}
      <span style={{ color: theme.inkFaint, fontSize: 18, fontWeight: 700 }}>{unit}</span>
    </span>
  );
}

/**
 * A single leaderboard list row below the podium: rank · avatar · name · value · (tier/rp chip).
 */
export function ListRow({
  entry,
  theme,
  rpUnit,
  nameMax,
  height,
}: {
  entry: CardEntry;
  theme: CardTheme;
  rpUnit: string;
  nameMax: number;
  height: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        height,
        padding: '0 28px',
        borderRadius: 18,
        backgroundColor: theme.panel,
        border: `1px solid ${theme.hair}`,
      }}
    >
      <span
        className="frdup-export-num"
        style={{ width: 52, color: theme.inkMuted, fontSize: 32, fontWeight: 700, textAlign: 'center', flex: '0 0 auto' }}
      >
        {entry.rank}
      </span>
      <InitialsAvatar entry={entry} size={Math.round(height * 0.62)} />
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div
          style={{
            color: theme.ink,
            fontSize: 32,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {truncateName(displayName(entry), nameMax)}
        </div>
        <div style={{ color: theme.inkFaint, fontSize: 21, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.secondary}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: '0 0 auto' }}>
        {entry.rpDelta !== undefined && entry.rpDelta !== null ? (
          <RpDeltaChip delta={entry.rpDelta} unit={rpUnit} theme={theme} />
        ) : (
          <TierChip entry={entry} theme={theme} />
        )}
        <span
          className="frdup-export-num"
          style={{ color: theme.ink, fontSize: 38, fontWeight: 700, minWidth: 96, textAlign: 'right' }}
        >
          {entry.primaryValue}
        </span>
      </div>
    </div>
  );
}

/**
 * A podium column. `place` is 1/2/3 (medal), `heightPx` is the pedestal height (visual rank),
 * and `tall` toggles the larger TierBadge size for first place.
 */
export function PodiumColumn({
  entry,
  place,
  heightPx,
  avatarSize,
  nameMax,
  theme,
  accent,
}: {
  entry: CardEntry;
  place: number;
  heightPx: number;
  avatarSize: number;
  nameMax: number;
  theme: CardTheme;
  accent: string;
}) {
  const first = place === 1;
  const pedestalColor = first ? accent : theme.panel;
  const pedestalInk = first ? theme.accentOn : theme.inkMuted;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', flex: '1 1 0', minWidth: 0, gap: 16 }}>
      <InitialsAvatar entry={entry} size={avatarSize} ring={accent} />
      {entry.tier ? (
        <TierBadge tier={entry.tier.key} division={entry.tier.division} stars={entry.tier.stars} size={first ? 'lg' : 'md'} />
      ) : (
        <span style={{ height: first ? 80 : 48 }} aria-hidden="true" />
      )}
      <div style={{ textAlign: 'center', width: '100%', minWidth: 0 }}>
        <div
          style={{
            color: theme.ink,
            fontSize: first ? 38 : 32,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
        >
          {truncateName(displayName(entry), nameMax)}
        </div>
        <div className="frdup-export-num" style={{ color: accent, fontSize: first ? 56 : 44, fontWeight: 700, lineHeight: 1.1 }}>
          {entry.primaryValue}
        </div>
        <div style={{ color: theme.inkFaint, fontSize: 20, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.secondary}
        </div>
      </div>
      <div
        style={{
          width: '100%',
          height: heightPx,
          borderRadius: '16px 16px 0 0',
          backgroundColor: pedestalColor,
          border: `1px solid ${theme.hair}`,
          borderBottom: 'none',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span className="frdup-export-num" style={{ color: pedestalInk, fontSize: 64, fontWeight: 700 }}>
          {place}
        </span>
      </div>
    </div>
  );
}
