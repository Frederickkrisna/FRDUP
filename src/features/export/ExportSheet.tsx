import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/Sheet';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Button } from '@/components/Button';
import { toast } from '@/components/toast/toastStore';
import type { CardFormat, CardTemplateId, LeaderboardCardData, RenderedCard, TierUpCardData } from './types';
import { CARD_SIZE } from './types';
import { LeaderboardCard } from './LeaderboardCard';
import { TierUpCard } from './TierUpCard';
import { renderCard } from './render';
import { canShareFiles, downloadCard, shareCard } from './share';
import { exportFilename, type ExportKind } from './filename';
import type { SportId } from '@/types/sport';
import './export.css';

/**
 * Self-contained export sheet. Shows a live preview of the exact React element that will be
 * exported (WYSIWYG), a format picker, a template picker with live scaled thumbnails, and
 * share/download actions. Persists the last format/template to localStorage.
 */

const TEMPLATES: CardTemplateId[] = ['court', 'night', 'paper'];
const PREFS_KEY = 'frdup.export.prefs';

interface Prefs {
  template: CardTemplateId;
  format: CardFormat;
}

function readPrefs(): Prefs {
  const fallback: Prefs = { template: 'court', format: 'feed' };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const template = TEMPLATES.includes(parsed.template as CardTemplateId) ? (parsed.template as CardTemplateId) : fallback.template;
    const format: CardFormat = parsed.format === 'story' ? 'story' : 'feed';
    return { template, format };
  } catch {
    return fallback;
  }
}

function writePrefs(prefs: Prefs): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota / private-mode write failures; prefs are a convenience only.
  }
}

/** A real card scaled to fit a box of `boxWidth` via transform (no PNG). */
function ScaledCard({ element, format, boxWidth }: { element: ReactElement; format: CardFormat; boxWidth: number }) {
  const { width, height } = CARD_SIZE[format];
  const scale = boxWidth / width;
  return (
    <div
      aria-hidden="true"
      style={{ width: boxWidth, height: height * scale, overflow: 'hidden', borderRadius: 16, flex: '0 0 auto' }}
    >
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{element}</div>
    </div>
  );
}

type RenderBody = (template: CardTemplateId, format: CardFormat) => ReactElement;

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
  kind: ExportKind;
  sportId: SportId;
  dateIso: string;
  shareTitle: string;
  sportName: string;
  brand: string;
  renderBody: RenderBody;
}

function ExportSheetBase({
  open,
  onClose,
  title,
  kind,
  sportId,
  dateIso,
  shareTitle,
  sportName,
  brand,
  renderBody,
}: BaseProps) {
  const { t } = useTranslation();
  const initial = useMemo(() => readPrefs(), []);
  const [template, setTemplate] = useState<CardTemplateId>(initial.template);
  const [format, setFormat] = useState<CardFormat>(initial.format);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(0);
  const shareable = useMemo(() => canShareFiles(), []);

  useEffect(() => {
    writePrefs({ template, format });
  }, [template, format]);

  // Measure the preview column so the scaled card fits exactly at the sheet width.
  useEffect(() => {
    if (!open) return;
    const el = previewRef.current;
    if (!el) return;
    const measure = () => setPreviewWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const makeCard = useCallback(async (): Promise<RenderedCard> => {
    return renderCard(renderBody(template, format), format);
  }, [renderBody, template, format]);

  const withRender = useCallback(
    async (action: (card: RenderedCard) => Promise<void>) => {
      setBusy(true);
      setError(false);
      let card: RenderedCard | null = null;
      try {
        card = await makeCard();
        await action(card);
      } catch {
        // Any failure (typed ExportRenderError or otherwise) surfaces the same user-facing toast.
        setError(true);
        toast.danger(t('export.toast.error'));
      } finally {
        if (card) URL.revokeObjectURL(card.url);
        setBusy(false);
      }
    },
    [makeCard, t],
  );

  const onShare = useCallback(() => {
    const filename = exportFilename(kind, sportId, dateIso, format);
    const shareText = t('export.shareText', { title: shareTitle, sport: sportName, brand });
    void withRender(async (card) => {
      await shareCard(card, filename, shareText);
    });
  }, [kind, sportId, dateIso, format, t, shareTitle, sportName, brand, withRender]);

  const onDownload = useCallback(() => {
    const filename = exportFilename(kind, sportId, dateIso, format);
    void withRender(async (card) => {
      downloadCard(card, filename);
    });
  }, [kind, sportId, dateIso, format, withRender]);

  const preview = renderBody(template, format);

  const footer = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!shareable ? (
        <p style={{ margin: 0, color: 'var(--c-text-muted)', fontSize: 13, lineHeight: 1.4 }}>{t('export.iosHint')}</p>
      ) : null}
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="primary" fullWidth loading={busy} onClick={onShare}>
          {shareable ? t('export.action.share') : t('export.action.download')}
        </Button>
        <Button variant="secondary" fullWidth disabled={busy} onClick={onDownload}>
          {t('export.action.save')}
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} closeLabel={t('export.close')} footer={footer}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SegmentedControl
          ariaLabel={t('export.format.label')}
          value={format}
          onChange={setFormat}
          options={[
            { value: 'feed', label: t('export.format.feed') },
            { value: 'story', label: t('export.format.story') },
          ]}
        />

        {/* Template picker — live scaled thumbnails of the real card. */}
        <div role="radiogroup" aria-label={t('export.template.label')} className="hide-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {TEMPLATES.map((id) => {
            const selected = id === template;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTemplate(id)}
                className="pressable no-select"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 6,
                  borderRadius: 18,
                  border: `2px solid ${selected ? 'var(--c-primary)' : 'var(--c-border)'}`,
                  background: 'var(--c-surface-2)',
                  minWidth: 96,
                  flex: '0 0 auto',
                }}
              >
                <ScaledCard element={renderBody(id, format)} format={format} boxWidth={84} />
                <span style={{ color: selected ? 'var(--c-text)' : 'var(--c-text-muted)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                  {t(`export.template.${id}`)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Large preview — the exact element used for export. */}
        <div ref={previewRef} style={{ width: '100%' }}>
          {previewWidth > 0 ? (
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <ScaledCard element={preview} format={format} boxWidth={previewWidth} />
            </div>
          ) : null}
        </div>

        {error ? (
          <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 12, border: '1px solid var(--c-danger)', color: 'var(--c-text)' }}>
            <strong style={{ fontSize: 15 }}>{t('export.error.title')}</strong>
            <span style={{ color: 'var(--c-text-muted)', fontSize: 14 }}>{t('export.error.body')}</span>
            <Button variant="secondary" onClick={onShare} loading={busy}>
              {t('export.action.retry')}
            </Button>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

/** Leaderboard export sheet. */
export function ExportSheet({ open, onClose, data }: { open: boolean; onClose: () => void; data: LeaderboardCardData }) {
  const { t } = useTranslation();
  const renderBody = useCallback<RenderBody>(
    (template, format) => <LeaderboardCard data={data} template={template} format={format} />,
    [data],
  );
  return (
    <ExportSheetBase
      open={open}
      onClose={onClose}
      title={t('export.sheetTitle')}
      kind={data.kind}
      sportId={data.sportId}
      dateIso={data.dateIso ?? data.dateLabel}
      shareTitle={data.title}
      sportName={data.sportName}
      brand={data.captions.brand}
      renderBody={renderBody}
    />
  );
}

/** Tier-up export sheet variant. */
export function TierUpExport({ open, onClose, data }: { open: boolean; onClose: () => void; data: TierUpCardData }) {
  const { t } = useTranslation();
  const renderBody = useCallback<RenderBody>(
    (template, format) => <TierUpCard data={data} template={template} format={format} />,
    [data],
  );
  return (
    <ExportSheetBase
      open={open}
      onClose={onClose}
      title={t('export.tierUpSheetTitle')}
      kind="tierup"
      sportId={data.sportId}
      dateIso={data.dateIso ?? data.dateLabel}
      shareTitle={data.tierName}
      sportName={data.sportName}
      brand={data.captions.brand}
      renderBody={renderBody}
    />
  );
}
