// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShareFiles, downloadCard, shareCard } from './share';
import type { RenderedCard } from './types';

function fakeCard(): RenderedCard {
  const blob = new Blob([new Uint8Array(32 * 1024)], { type: 'image/png' });
  return { blob, url: 'blob:fake', width: 1080, height: 1350 };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('canShareFiles', () => {
  it('is false when the Web Share API is absent', () => {
    // jsdom has no navigator.share by default.
    expect(canShareFiles()).toBe(false);
  });

  it('is true when canShare approves a file payload', () => {
    vi.stubGlobal('navigator', {
      share: vi.fn(),
      canShare: vi.fn(() => true),
    });
    expect(canShareFiles()).toBe(true);
  });
});

describe('shareCard', () => {
  it('downloads when sharing is unsupported', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
    const outcome = await shareCard(fakeCard(), 'frdup-badminton-2026-09-12-feed.png');
    expect(outcome).toBe('downloaded');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('returns "shared" on a successful native share', async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { share, canShare: vi.fn(() => true) });
    const outcome = await shareCard(fakeCard(), 'x.png', 'hello');
    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
  });

  it('returns "cancelled" when the user aborts', async () => {
    const abort = new DOMException('cancelled', 'AbortError');
    vi.stubGlobal('navigator', { share: vi.fn(() => Promise.reject(abort)), canShare: vi.fn(() => true) });
    const outcome = await shareCard(fakeCard(), 'x.png');
    expect(outcome).toBe('cancelled');
  });

  it('falls back to download when a non-abort share error occurs', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
    vi.stubGlobal('navigator', {
      share: vi.fn(() => Promise.reject(new Error('target rejected'))),
      canShare: vi.fn(() => true),
    });
    const outcome = await shareCard(fakeCard(), 'x.png');
    expect(outcome).toBe('downloaded');
  });
});

describe('downloadCard', () => {
  it('dispatches an anchor click', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
    downloadCard(fakeCard(), 'frdup-padel-2026-01-01-story.png');
    expect(clickSpy).toHaveBeenCalled();
  });
});
