import { useTranslation } from 'react-i18next';
import { CARD_SIZE } from './types';
import type { CardFormat, CardTemplateId, LeaderboardCardData } from './types';
import { CARD_THEME, cardMetrics, sportAccentVar } from './cardTheme';
import type { CardTheme } from './cardTheme';
import { computeLayout, podiumHeights } from './layout';
import { ListRow, PodiumColumn } from './CardParts';
import './export.css';

/**
 * The leaderboard share card. One component renders all three templates (`court`, `night`,
 * `paper`) for both formats (`feed` 1080x1350, `story` 1080x1920). Layout adapts to the taller
 * story format (bigger podium, more rows). Rendered at exact pixel size for off-screen capture.
 */

type Props = {
  data: LeaderboardCardData;
  template: CardTemplateId;
  format: CardFormat;
};

export function LeaderboardCard({ data, template, format }: Props) {
  const { t } = useTranslation();
  const theme = CARD_THEME[template];
  const size = CARD_SIZE[format];
  const metrics = cardMetrics(format);
  const accent = template === 'court' ? theme.accent : sportAccentVar(data.sportId);
  const layout = computeLayout(data.entries, template, format);
  const heights = podiumHeights(layout.podium.length);

  // Pedestal heights by medal place, scaled to the template's podium budget.
  const pedestalFor = (place: number): number => {
    const ratio = place === 1 ? heights.first : place === 2 ? heights.second : heights.third;
    return Math.round(metrics.podiumMax * 0.42 * ratio) + 24;
  };

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
        gap: 40,
      }}
    >
      <TemplateBackdrop template={template} accent={accent} />

      <Header data={data} theme={theme} accent={accent} titleSize={metrics.titleSize} template={template} />

      {layout.hasPodium ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, zIndex: 1 }}>
          {layout.podium.map((entry) => (
            <PodiumColumn
              key={entry.playerId}
              entry={entry}
              place={entry.rank}
              heightPx={pedestalFor(entry.rank)}
              avatarSize={entry.rank === 1 ? metrics.avatarPodium : Math.round(metrics.avatarPodium * 0.82)}
              nameMax={metrics.nameMax - 4}
              theme={theme}
              accent={accent}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            flex: '1 1 auto',
            display: 'grid',
            placeItems: 'center',
            color: theme.inkFaint,
            fontSize: 40,
            fontWeight: 700,
            zIndex: 1,
          }}
        >
          {t('export.card.empty')}
        </div>
      )}

      {layout.rows.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: metrics.rowGap, flex: '1 1 auto', zIndex: 1 }}>
          {layout.rows.map((entry) => (
            <ListRow
              key={entry.playerId}
              entry={entry}
              theme={theme}
              rpUnit={data.captions.rpUnit}
              nameMax={metrics.nameMax}
              height={metrics.rowHeight}
            />
          ))}
          {layout.overflow > 0 ? (
            <div style={{ color: theme.inkMuted, fontSize: 26, fontWeight: 700, padding: '8px 28px' }}>
              {t('export.card.morePlayers', { count: layout.overflow })}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ flex: '1 1 auto' }} aria-hidden="true" />
      )}

      <Footer data={data} theme={theme} accent={accent} template={template} />
    </div>
  );
}

/** Template-specific background decoration. Solid shapes / gradients only — no blur, no filters. */
function TemplateBackdrop({ template, accent }: { template: CardTemplateId; accent: string }) {
  if (template === 'court') {
    return <div className="frdup-court-lines" aria-hidden="true" style={{ zIndex: 0 }} />;
  }
  if (template === 'night') {
    return (
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <div className="frdup-night-glow" style={{ width: 900, height: 900, top: -360, right: -300, backgroundColor: accent, opacity: 0.16 }} />
        <div className="frdup-night-glow" style={{ width: 700, height: 700, bottom: -320, left: -260, backgroundColor: 'var(--c-info)', opacity: 0.1 }} />
      </div>
    );
  }
  // paper: a subtle top accent rule, drawn as a solid bar.
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, backgroundColor: accent }} />
    </div>
  );
}

function Header({
  data,
  theme,
  accent,
  titleSize,
  template,
}: {
  data: LeaderboardCardData;
  theme: CardTheme;
  accent: string;
  titleSize: number;
  template: CardTemplateId;
}) {
  const { t } = useTranslation();
  const kindLabel = data.kind === 'alltime' ? t('export.card.allTime') : t('export.card.session');
  return (
    <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ width: 16, height: 16, borderRadius: template === 'paper' ? 3 : '999px', backgroundColor: accent, flex: '0 0 auto' }} />
        <span style={{ color: accent, fontSize: 24, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {data.sportName}
        </span>
        <span style={{ color: theme.inkFaint, fontSize: 24, fontWeight: 600 }}>·</span>
        <span style={{ color: theme.inkMuted, fontSize: 24, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {kindLabel}
        </span>
      </div>
      <h1 style={{ margin: 0, color: theme.ink, fontSize: titleSize, fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.02em' }}>
        {data.title}
      </h1>
      {data.subtitle ? (
        <div style={{ color: theme.inkMuted, fontSize: 26, fontWeight: 500 }}>{data.subtitle}</div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: theme.inkFaint, fontSize: 24, fontWeight: 600 }}>
        <span>{data.dateLabel}</span>
        <span>·</span>
        <span>{data.metaLine}</span>
      </div>
    </div>
  );
}

function Footer({
  data,
  theme,
  accent,
  template,
}: {
  data: LeaderboardCardData;
  theme: CardTheme;
  accent: string;
  template: CardTemplateId;
}) {
  return (
    <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
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
      <span style={{ color: theme.inkFaint, fontSize: 22, fontWeight: 600 }}>{data.captions.madeWith}</span>
    </div>
  );
}
