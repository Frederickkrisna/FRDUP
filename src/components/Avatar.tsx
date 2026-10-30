import { useState } from 'react';
import { cn } from './cn';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const DIM: Record<Size, { box: string; text: string; emoji: string }> = {
  xs: { box: 'size-7', text: 'text-[11px]', emoji: 'text-sm' },
  sm: { box: 'size-9', text: 'text-[13px]', emoji: 'text-base' },
  md: { box: 'size-12', text: 'text-base', emoji: 'text-2xl' },
  lg: { box: 'size-16', text: 'text-xl', emoji: 'text-3xl' },
};

type Props = {
  name: string;
  initials: string;
  /** Deterministic swatch from core/utils/avatar. */
  color: string;
  /** Optional profile image URL (http/data URL) or emoji */
  src?: string | null;
  size?: Size;
  /** CSS colour for a ring (e.g. tier colour). */
  ring?: string;
  className?: string;
};

/** Avatar with photo, emoji, or deterministic swatch + initials fallback. */
export function Avatar({ name, initials, color, src, size = 'md', ring, className }: Props) {
  const [loadError, setLoadError] = useState(false);
  const isImage = Boolean(src && !loadError && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('/')));
  const isEmoji = Boolean(src && !isImage && src.trim().length > 0);

  return (
    <span
      role="img"
      aria-label={name}
      className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-full font-extrabold text-primary-on select-none', DIM[size].box, DIM[size].text, className)}
      style={{ backgroundColor: color, boxShadow: ring ? `0 0 0 2px var(--c-bg), 0 0 0 4px ${ring}` : undefined }}
    >
      {isImage ? (
        <img
          src={src ?? ''}
          alt={name}
          className="size-full rounded-full object-cover"
          onError={() => setLoadError(true)}
        />
      ) : isEmoji ? (
        <span className={cn('leading-none select-none', DIM[size].emoji)}>{src}</span>
      ) : (
        initials
      )}
    </span>
  );
}
