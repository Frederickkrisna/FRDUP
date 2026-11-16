/**
 * Links that leave this device (join QR, public board) must open on ANOTHER phone. During
 * development the app often runs on `localhost`, which a second phone cannot reach, so an optional
 * `VITE_PUBLIC_ORIGIN` (e.g. the hosting URL or `http://192.168.1.10:5173`) takes precedence.
 */
function configuredOrigin(): string | null {
  const raw = import.meta.env.VITE_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function publicOrigin(): string {
  return configuredOrigin() ?? window.location.origin;
}

export function publicUrl(path: string): string {
  return `${publicOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** True when the link would only work on this very device (localhost / loopback). */
export function isLoopbackOrigin(origin: string = publicOrigin()): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '[::1]' || host === '::1' || host.startsWith('127.') || host.endsWith('.localhost');
  } catch {
    return false;
  }
}
