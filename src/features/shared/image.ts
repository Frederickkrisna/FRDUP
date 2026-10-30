/** Client-side image compression for the QRIS upload (kept as a data URL inside the host doc). */

export class ImageTooLargeError extends Error {
  constructor(readonly bytes: number) {
    super(`image too large: ${bytes}`);
    this.name = 'ImageTooLargeError';
  }
}

const MAX_BYTES = 220_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('cannot decode image'));
    };
    img.src = url;
  });
}

/**
 * Downscales to `maxDim` and re-encodes as WebP/JPEG, stepping quality down until it fits.
 * A QR code needs sharp edges, so it stays high-contrast and is never blurred.
 */
export async function compressToDataUrl(file: File, maxDim = 900): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.fillStyle = 'white'; // transparent PNG QR codes must not turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.9, 0.8, 0.7, 0.55]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length * 0.75 <= MAX_BYTES) return url;
  }
  throw new ImageTooLargeError(Math.round(canvas.toDataURL('image/jpeg', 0.55).length * 0.75));
}
