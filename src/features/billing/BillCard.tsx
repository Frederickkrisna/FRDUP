import type { CardFormat } from '@/features/export/types';

export interface BillCardData {
  sportName: string;
  title: string;
  subtitle: string | null;
  dateLabel: string;
  items: Array<{ label: string; amount: string }>;
  totalLabel: string;
  total: string;
  dueTitle: string;
  rows: Array<{ name: string; amount: string }>;
  roundingLine: string | null;
  payment: { title: string; lines: string[]; qrisUrl: string | null; qrisCaption: string } | null;
  brand: string;
  madeWith: string;
}

/** Story format when there are many people to list; feed otherwise. */
export function billCardFormat(rowCount: number): CardFormat {
  return rowCount > 12 ? 'story' : 'feed';
}

/**
 * The split-bill image, 1080 px wide, fixed pixel sizes (it is rendered off-screen and captured at
 * exactly this size). Same court-line identity as the leaderboard, laid out like a printed receipt.
 */
export function BillCard({ data, format }: { data: BillCardData; format: CardFormat }) {
  const height = format === 'feed' ? 1350 : 1920;
  const twoCols = data.rows.length > 6;
  return (
    <div
      style={{
        width: 1080,
        height,
        background: 'var(--c-bg)',
        color: 'var(--c-text)',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '72px 72px 56px',
        boxSizing: 'border-box',
      }}
    >
      {/* court lines */}
      <svg width="1080" height={height} viewBox={`0 0 1080 ${height}`} style={{ position: 'absolute', inset: 0, opacity: 0.1 }} aria-hidden="true">
        <rect x="-40" y="-40" width="1160" height={height + 80} fill="none" stroke="var(--c-primary)" strokeWidth="6" />
        <line x1="0" y1={height / 2} x2="1080" y2={height / 2} stroke="var(--c-primary)" strokeWidth="6" />
        <line x1="540" y1="0" x2="540" y2={height} stroke="var(--c-primary)" strokeWidth="3" />
      </svg>

      <header style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: 30, fontWeight: 700, color: 'var(--c-text-muted)' }}>{data.sportName}</p>
          <h1 style={{ margin: '8px 0 0', fontSize: 84, fontWeight: 800, lineHeight: 1.02 }}>{data.title}</h1>
          <p style={{ margin: '14px 0 0', fontSize: 30, color: 'var(--c-text-muted)' }}>{[data.dateLabel, data.subtitle].filter(Boolean).join(' · ')}</p>
        </div>
        <p style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--c-primary)' }}>{data.brand}</p>
      </header>

      <section style={{ position: 'relative', marginTop: 48 }}>
        {data.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, padding: '14px 0', borderBottom: '2px solid var(--c-border)', fontSize: 34 }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{it.amount}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '22px 0 0', fontSize: 40, fontWeight: 800 }}>
          <span>{data.totalLabel}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--c-primary)', fontSize: 56 }}>{data.total}</span>
        </div>
      </section>

      <section style={{ position: 'relative', marginTop: 44, flex: 1, minHeight: 0 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 30, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-muted)' }}>{data.dueTitle}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: twoCols ? '1fr 1fr' : '1fr', columnGap: 48 }}>
          {data.rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', fontSize: 34, borderBottom: '2px solid var(--c-border)' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{r.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{r.amount}</span>
            </div>
          ))}
        </div>
        {data.roundingLine ? <p style={{ margin: '18px 0 0', fontSize: 26, color: 'var(--c-text-muted)' }}>{data.roundingLine}</p> : null}
      </section>

      <footer style={{ position: 'relative', marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }}>
        {data.payment ? (
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-primary)' }}>{data.payment.title}</p>
            {data.payment.lines.map((l, i) => (
              <p key={i} style={{ margin: '6px 0 0', fontSize: 34, fontWeight: i === 0 ? 700 : 500, fontFamily: i === 1 ? 'var(--font-mono)' : undefined }}>
                {l}
              </p>
            ))}
          </div>
        ) : (
          <span />
        )}
        {data.payment?.qrisUrl ? (
          <div style={{ textAlign: 'center' }}>
            <img src={data.payment.qrisUrl} alt="" width={220} height={220} style={{ background: 'white', padding: 10, borderRadius: 12, objectFit: 'contain' }} />
            <p style={{ margin: '8px 0 0', fontSize: 22, color: 'var(--c-text-muted)' }}>{data.payment.qrisCaption}</p>
          </div>
        ) : null}
      </footer>
      <p style={{ position: 'relative', margin: '24px 0 0', textAlign: 'center', fontSize: 22, color: 'var(--c-text-faint)' }}>{data.madeWith}</p>
    </div>
  );
}
