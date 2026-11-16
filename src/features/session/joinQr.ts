/**
 * Join QR as a shareable PNG (QR + the code underneath), so a host can drop it into a WhatsApp
 * group instead of only a link. Built from the hidden <QRCodeCanvas> rendered by the screen.
 */

import { copyText } from '@/features/billing/billExport';
import { canShareFiles, downloadCard } from '@/features/export/share';

const PAD = 48;
const CAPTION_H = 132;
// Paper colours on purpose: a QR must stay dark-on-light whatever the app theme is.
const PAPER = 'white';
const INK = 'black';

export type JoinShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

function isAbort(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError';
}

export async function joinQrPng(qr: HTMLCanvasElement, code: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = qr.width + PAD * 2;
  canvas.height = qr.height + PAD * 2 + CAPTION_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qr, PAD, PAD);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 88px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  ctx.fillText(code.split('').join(' '), canvas.width / 2, qr.height + PAD + CAPTION_H / 2);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export function joinQrFilename(code: string): string {
  return `frdup-gabung-${code}.png`;
}

/**
 * Best channel first: native share sheet with the QR image + link, then link-only share, then the
 * clipboard. Never throws; a user cancel is not an error.
 */
export async function shareJoin(args: { title: string; text: string; link: string; image: Blob | null; filename: string }): Promise<JoinShareOutcome> {
  const { title, text, link, image, filename } = args;
  const message = `${text}\n${link}`;
  if (typeof navigator.share === 'function') {
    if (image && canShareFiles()) {
      const file = new File([image], filename, { type: 'image/png' });
      try {
        // `url` is often dropped when files are attached, so the link rides in the text.
        await navigator.share({ title, text: message, files: [file] });
        return 'shared';
      } catch (error) {
        if (isAbort(error)) return 'cancelled';
      }
    }
    try {
      await navigator.share({ title, text, url: link });
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
    }
  }
  return (await copyText(message)) ? 'copied' : 'failed';
}

export function downloadJoinQr(image: Blob, filename: string): void {
  downloadCard({ blob: image, url: '', width: 0, height: 0 }, filename);
}
