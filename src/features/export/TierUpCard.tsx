import { useTranslation } from 'react-i18next';
import { TierBadge } from '@/components/TierBadge';
import { CARD_SIZE } from './types';
import type { CardFormat, CardTemplateId, TierUpCardData } from './types';
import { CARD_THEME, cardMetrics, sportAccentVar, tierSolidVar } from './cardTheme';
import type { CardTheme } from './cardTheme';
import { InitialsAvatar } from './CardParts';
import { truncateName } from './layout';
import './export.css';

/**
 * Single-player tier-up share card. Same three templates and two formats as the leaderboard card.
 * The hero is the destination tier badge; `from` → `to` makes the promotion legible.
 */

type Props = {
  data: TierUpCardData;
  template: CardTemplateId;
  format: CardFormat;
};

export function TierUpCard({ data, template, format }: Props) {
  const { t } = useTranslation();
  const theme = CARD_THEME[template];
  const size = CARD_SIZE[format];
  const metrics = cardMetrics(format);
  const accent = template === 'court' ? theme.accent : sportAccentVar(data.sportId);
  const toSolid = tierSolidVar(data.to.key);

  return (
    <div
      className="frdup-export-card"
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: theme.bg,
        color: theme.ink,
        colorScheme: theme.colorScheme,
        display: 'flex',
        flexDirection: 'column',
        padding: metrics.pad,
      }}
    >
      {template === 'court' ? <div className="frdup-court-lines" aria-hidden="true" style={{ zIndex: 0 }} /> : null}
      {template === 'night' ? (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          <div className="frdup-night-glow" style={{ width: 1000, height: 1000, top: '18%', left: '50%', transform: 'translateX(-50%)', backgroundColor: toSolid, opacity: 0.2 }} />
        </div>
      ) : null}
      {template === 'paper' ? (
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, backgroundColor: accent, zIndex: 0 }} />
      ) : null}

      {/* Sport + headline */}
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 16, height: 16, borderRadius: template === 'paper' ? 3 : '999px', backgroundColor: accent }} />
          <span style={{ color: accent, fontSize: 26, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {data.sportName}
          </span>
        </div>
        <div style={{ color: theme.inkMuted, fontSize: 30, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {data.headline}
        </div>
      </div>

      {/* Hero badge */}
      <div style={{ zIndex: 1, flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <TierBadge tier={data.to.key} division={data.to.division} stars={data.to.stars} size="hero" />
        <div style={{ color: theme.ink, fontSize: format === 'story' ? 96 : 80, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>
          {data.tierName}
        </div>

        {/* from -> to */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <FromToPill label={t('export.tierUp.from')} tier={tierSolidVar(data.from.key)} theme={theme} />
          <span style={{ color: accent, fontSize: 48, fontWeight: 800 }}>{'\u2192'}</span>
          <FromToPill label={t('export.tierUp.to')} tier={toSolid} theme={theme} emphasised />
        </div>
      </div>

      {/* Player + RP */}
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <InitialsAvatar entry={{ name: data.playerName, initials: data.initials, avatarColor: data.avatarColor }} size={96} ring={accent} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: theme.ink, fontSize: 52, fontWeight: 800, maxWidth: size.width - 2 * metrics.pad - 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {truncateName(data.playerName, format === 'story' ? 20 : 16)}
            </div>
            <div className="frdup-export-num" style={{ color: accent, fontSize: 40, fontWeight: 700 }}>{data.rpLabel}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              borderRadius: template === 'paper' ? 8 : 12,
              backgroundColor: accent,
              color: theme.accentOn,
              fontWeight: 800,
              fontSize: 26,
            }}
          >
            {data.captions.brand.slice(0, 1)}
          </span>
          <span style={{ color: theme.ink, fontSize: 30, fontWeight: 800, letterSpacing: '0.02em' }}>{data.captions.brand}</span>
        </div>
        <span style={{ color: theme.inkFaint, fontSize: 22, fontWeight: 600 }}>{data.dateLabel}</span>
      </div>
    </div>
  );
}

function FromToPill({
  label,
  tier,
  theme,
  emphasised,
}: {
  label: string;
  tier: string;
  theme: CardTheme;
  emphasised?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <span style={{ color: theme.inkFaint, fontSize: 20, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span
        style={{
          width: emphasised ? 44 : 32,
          height: emphasised ? 44 : 32,
          borderRadius: '999px',
          backgroundColor: tier,
          boxShadow: emphasised ? `0 0 0 4px ${theme.panel}` : undefined,
        }}
      />
    </div>
  );
}
