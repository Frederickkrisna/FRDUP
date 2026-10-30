import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { LeaderboardCard } from '@/features/export/LeaderboardCard';
import { TierUpCard } from '@/features/export/TierUpCard';
import { ExportSheet, TierUpExport } from '@/features/export/ExportSheet';
import { demoLeaderboard, demoTierUp } from '@/features/export/demoData';
import { renderCard } from '@/features/export/render';
import { CARD_SIZE, type CardFormat, type CardTemplateId } from '@/features/export/types';

/** DEV ONLY (not routed in production builds): visual + pipeline harness for Chromium/WebKit tests. */
export function ExportDemo() {
  const [params] = useSearchParams();
  const template = (params.get('template') ?? 'court') as CardTemplateId;
  const format = (params.get('format') ?? 'feed') as CardFormat;
  const count = Number(params.get('count') ?? 9);
  const kind = params.get('kind') === 'tierup' ? 'tierup' : params.get('kind') === 'alltime' ? 'alltime' : 'session';
  const [png, setPng] = useState<{ url: string; bytes: number; width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  const board = demoLeaderboard(count, kind === 'alltime' ? 'alltime' : 'session');
  const tier = demoTierUp();
  const element = kind === 'tierup' ? <TierUpCard data={tier} template={template} format={format} /> : <LeaderboardCard data={board} template={template} format={format} />;

  const render = async () => {
    setError(null);
    try {
      const card = await renderCard(element, format);
      const img = new Image();
      img.src = card.url;
      await img.decode();
      setPng({ url: card.url, bytes: card.blob.size, width: img.naturalWidth, height: img.naturalHeight });
    } catch (e) {
      setError(String(e));
    }
  };

  const size = CARD_SIZE[format];
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button data-testid="render" onClick={() => void render()} style={{ minHeight: 44, padding: '0 16px' }}>render</button>
        <button data-testid="open-sheet" onClick={() => setSheet(true)} style={{ minHeight: 44, padding: '0 16px' }}>sheet</button>
      </div>
      {error ? <pre data-testid="error">{error}</pre> : null}
      {png ? (
        <div data-testid="result" data-bytes={png.bytes} data-width={png.width} data-height={png.height}>
          <img src={png.url} alt="" style={{ width: 360, height: (360 * png.height) / png.width }} />
        </div>
      ) : null}
      <div data-testid="live" style={{ width: size.width * 0.33, height: size.height * 0.33, overflow: 'hidden' }}>
        <div style={{ width: size.width, height: size.height, transform: 'scale(0.33)', transformOrigin: 'top left' }}>{element}</div>
      </div>
      {kind === 'tierup' ? <TierUpExport open={sheet} onClose={() => setSheet(false)} data={tier} /> : <ExportSheet open={sheet} onClose={() => setSheet(false)} data={board} />}
    </div>
  );
}
