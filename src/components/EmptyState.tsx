import type { ReactNode } from 'react';
import { cn } from './cn';

export type EmptyArt = 'players' | 'sessions' | 'chart' | 'bill' | 'search' | 'court';

/** Court-line art built from SVG primitives and theme variables (recolours automatically). */
function Art({ kind }: { kind: EmptyArt }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg viewBox="0 0 120 88" width="120" height="88" aria-hidden="true" className="text-line-strong">
      {kind === 'court' || kind === 'sessions' ? (
        <g {...common}>
          <rect x="22" y="12" width="76" height="64" rx="4" />
          <line x1="22" y1="44" x2="98" y2="44" />
          <line x1="60" y1="12" x2="60" y2="30" />
          <line x1="60" y1="58" x2="60" y2="76" />
          <rect x="38" y="30" width="44" height="28" />
          <circle cx="86" cy="22" r="4" className="text-primary" stroke="var(--c-primary)" fill="var(--c-primary)" />
        </g>
      ) : null}
      {kind === 'players' ? (
        <g {...common}>
          <circle cx="42" cy="34" r="12" />
          <path d="M20 72c0-12 10-20 22-20s22 8 22 20" />
          <circle cx="82" cy="40" r="9" />
          <path d="M70 72c1-9 7-15 15-15s14 5 15 15" />
          <path d="M96 14v12M90 20h12" stroke="var(--c-primary)" />
        </g>
      ) : null}
      {kind === 'chart' ? (
        <g {...common}>
          <path d="M18 70V16M18 70h86" />
          <path d="M28 56l20-14 16 8 22-26 12 10" stroke="var(--c-primary)" />
          <circle cx="98" cy="32" r="3" fill="var(--c-primary)" stroke="var(--c-primary)" />
        </g>
      ) : null}
      {kind === 'bill' ? (
        <g {...common}>
          <path d="M30 10h60v62l-10-6-10 6-10-6-10 6-10-6-10 6z" />
          <line x1="42" y1="28" x2="78" y2="28" />
          <line x1="42" y1="40" x2="78" y2="40" />
          <line x1="42" y1="52" x2="62" y2="52" stroke="var(--c-primary)" />
        </g>
      ) : null}
      {kind === 'search' ? (
        <g {...common}>
          <circle cx="54" cy="38" r="20" />
          <line x1="69" y1="53" x2="92" y2="76" stroke="var(--c-primary)" />
        </g>
      ) : null}
    </svg>
  );
}

type Props = {
  art?: EmptyArt;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ art = 'court', title, body, action, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <Art kind={art} />
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      {body ? <p className="max-w-[28ch] text-[15px] text-ink-muted">{body}</p> : null}
      {action ? <div className="mt-2 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}
