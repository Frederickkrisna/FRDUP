import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { toBlob } from 'html-to-image';
import type { ReactElement } from 'react';
import { i18n } from '@/i18n';
import { CARD_SIZE } from './types';
import type { CardFormat, RenderedCard } from './types';
import './export.css';

/**
 * Off-screen rendering pipeline. Mounts a card element into a hidden, fixed-size container,
 * waits for fonts and images, performs a warm-up capture (WebKit frequently returns a blank first
 * frame from html-to-image), then captures the real PNG at exactly CARD_SIZE[format] with
 * pixelRatio 1. The output never depends on the viewport, scroll, or the app's dark/light state.
 */

/** Typed error so callers can distinguish a render failure from a share/cancel outcome. */
export class ExportRenderError extends Error {
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ExportRenderError';
    this.cause = cause;
  }
}

/** Blobs below this are treated as blank/partial captures (WebKit failure mode). */
const MIN_BLOB_BYTES = 20 * 1024;

/** Font specs the cards use; loaded explicitly so the first real capture has glyphs. */
const FONT_SPECS = [
  '700 32px "JetBrains Mono"',
  '500 15px "JetBrains Mono"',
  '800 32px "Plus Jakarta Sans"',
  '700 32px "Plus Jakarta Sans"',
  '600 17px "Plus Jakarta Sans"',
  '400 15px "Plus Jakarta Sans"',
];

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  await document.fonts.ready;
  await Promise.all(
    FONT_SPECS.map((spec) =>
      document.fonts.load(spec).catch(() => {
        // A font that fails to load should not abort the capture; the fallback face renders.
      }),
    ),
  );
}

async function decodeImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      try {
        if (img.decode) await img.decode();
      } catch {
        // Ignore decode failures — html-to-image substitutes an empty area per its options.
      }
    }),
  );
}

function captureOptions(format: CardFormat): Parameters<typeof toBlob>[1] {
  const { width, height } = CARD_SIZE[format];
  return {
    width,
    height,
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 1,
    cacheBust: true,
    // The stage sets its own background; keep it transparent-free by letting the card paint it.
    style: { margin: '0', transform: 'none' },
  };
}

/**
 * Render `element` off-screen and capture it to a PNG blob. Always cleans up the container and the
 * React root, even on failure. Throws `ExportRenderError` if no acceptable blob can be produced.
 */
export async function renderCard(element: ReactElement, format: CardFormat): Promise<RenderedCard> {
  if (typeof document === 'undefined') {
    throw new ExportRenderError('renderCard requires a DOM environment.');
  }

  const { width, height } = CARD_SIZE[format];
  const stage = document.createElement('div');
  stage.className = 'frdup-export-stage';
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  document.body.appendChild(stage);

  let root: Root | null = null;

  try {
    root = createRoot(stage);
    // flushSync guarantees the tree is committed before we measure/capture.
    flushSync(() => {
      root?.render(createElement(I18nextProvider, { i18n }, element));
    });

    const node = stage.firstElementChild;
    if (!(node instanceof HTMLElement)) {
      throw new ExportRenderError('Card element did not mount.');
    }

    await loadFonts();
    await decodeImages(node);
    await nextFrame();
    await nextFrame();

    const options = captureOptions(format);

    // Warm-up render — discarded. WebKit often returns a blank/partial first image.
    await toBlob(node, options).catch(() => null);

    let blob = await toBlob(node, options);
    if (!blob || blob.size < MIN_BLOB_BYTES) {
      // One retry after another frame.
      await nextFrame();
      blob = await toBlob(node, options);
    }

    if (!blob) {
      throw new ExportRenderError('html-to-image returned no blob.');
    }
    if (blob.size < MIN_BLOB_BYTES) {
      throw new ExportRenderError(`Captured image is suspiciously small (${blob.size} bytes).`);
    }

    const url = URL.createObjectURL(blob);
    return { blob, url, width, height };
  } catch (error) {
    if (error instanceof ExportRenderError) throw error;
    throw new ExportRenderError('Failed to render export card.', error);
  } finally {
    if (root) {
      const toUnmount = root;
      // Defer unmount to avoid synchronous unmount during React render/commit.
      setTimeout(() => toUnmount.unmount(), 0);
    }
    setTimeout(() => stage.remove(), 0);
  }
}
