/**
 * Share pipeline. Web Share API Level 2 (files) when available — the native iOS/Android share
 * sheet — otherwise a download via an `<a download>` object URL. Never throws on user cancel.
 */

import type { RenderedCard, ShareOutcome } from './types';

const PNG_MIME = 'image/png';

function toFile(card: RenderedCard, filename: string): File {
  return new File([card.blob], filename, { type: PNG_MIME });
}

/** Feature detection: can this browser share a PNG file via the native share sheet? */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    const probe = new File([new Blob([new Uint8Array(1)], { type: PNG_MIME })], 'probe.png', {
      type: PNG_MIME,
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Download the card as a PNG using a transient object URL. Resolves once the click is dispatched. */
export function downloadCard(card: RenderedCard, filename: string): void {
  const url = URL.createObjectURL(card.blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Share the card. Uses the native share sheet with the image file when supported; on unsupported
 * platforms (desktop, some Android WebViews) it falls back to a download. A user cancel resolves
 * to `'cancelled'` rather than rejecting.
 */
export async function shareCard(
  card: RenderedCard,
  filename: string,
  shareText?: string,
): Promise<ShareOutcome> {
  const file = toFile(card, filename);
  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  if (canShare) {
    try {
      await navigator.share(shareText ? { files: [file], text: shareText } : { files: [file] });
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
      // Share failed for a non-cancel reason (e.g. target rejected the payload): fall back.
      downloadCard(card, filename);
      return 'downloaded';
    }
  }

  downloadCard(card, filename);
  return 'downloaded';
}
