import { useEffect, useRef, useState } from 'react';
import { Link2, RefreshCw, Share2, Smartphone, WifiOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { toast } from '@/components/toast/toastStore';
import { cn } from '@/components/cn';
import { isJoinCodeLive } from '@/core/session/joinCode';
import { sessionRepo } from '@/data/sessionRepo';
import { copyText } from '@/features/billing/billExport';
import { useNow } from '@/features/shared/useNow';
import { useBootStore } from '@/state/bootStore';
import { useSessionStore } from '@/state/sessionStore';
import { flushNow } from '@/state/sync';
import { useSyncStore } from '@/state/syncStore';

function formatCountdown(expiresAt: number | null, now: number): string {
  if (expiresAt === null) return '';
  const left = Math.max(0, expiresAt - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

export function JoinCodeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const session = useSessionStore((s) => s.session);
  const role = useSessionStore((s) => s.role);
  const setJoinCode = useSessionStore((s) => s.setJoinCode);
  const uid = useBootStore((s) => s.uid);
  const online = useSyncStore((s) => s.online);
  const coHosts = useSyncStore((s) => s.coHosts);
  const [busy, setBusy] = useState(false);
  const issued = useRef(false);

  const active = session?.id === sessionId ? session : null;
  const now = useNow(1000);
  const live = active ? isJoinCodeLive(active.joinCodeExpiresAt, now) : false;
  const countdown = formatCountdown(active?.joinCodeExpiresAt ?? null, now);

  const issue = async () => {
    if (!active || !uid) return;
    setBusy(true);
    try {
      await flushNow(); // make sure the session doc exists for co-hosts to read
      const { code, expiresAt } = await sessionRepo.issueJoinCode(active.id, uid);
      setJoinCode(code, expiresAt);
    } catch {
      toast.danger(t('cohost.issueFailed'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!active || issued.current || live || !online) return;
    issued.current = true;
    void issue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, online]);

  if (!active || role !== 'host') {
    return <EmptyState art="court" title={t('session.notFound.title')} action={<Button onClick={() => void navigate('/home')}>{t('error.route.home')}</Button>} />;
  }

  const code = live ? active.joinCode : null;
  const link = code ? `${window.location.origin}/join/${code}` : '';

  const share = async () => {
    if (!code) return;
    const text = t('cohost.shareText', { code });
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('common.appName'), text, url: link });
        return;
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return;
      }
    }
    const ok = await copyText(`${text}\n${link}`);
    if (ok) toast.success(t('common.copied'));
    else toast.danger(t('bill.copyFailed'));
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      <ScreenHeader title={t('cohost.joinCode')} subtitle={t('cohost.joinCodeSubtitle')} onBack={() => void navigate(-1)} backLabel={t('common.back')} />

      <main className="flex flex-1 flex-col items-center gap-6 px-4 pb-8 pt-8">
        {!online ? (
          <p role="status" className="flex items-center gap-2 rounded-md border border-warning/60 bg-surface p-3 text-[14px] text-warning">
            <WifiOff size={18} aria-hidden="true" />
            {t('cohost.needsOnline')}
          </p>
        ) : null}

        {code ? (
          <>
            <div className="text-center">
              <p className="mb-2 text-[13px] font-semibold text-ink-muted">{t('cohost.codeLabel')}</p>
              <p className="num select-all text-[56px] font-bold leading-none tracking-[0.18em] text-primary" aria-label={code.split('').join(' ')}>
                {code}
              </p>
              <p className="num mt-3 text-[14px] text-ink-muted">{t('cohost.joinCodeExpiry', { duration: countdown })}</p>
            </div>

            <div className="rounded-lg bg-white p-4" role="img" aria-label={t('cohost.qrAlt', { code })}>
              <QRCodeSVG value={link} size={208} level="M" marginSize={0} />
            </div>
            <p className="max-w-[28ch] text-center text-[13px] text-ink-muted">{t('cohost.qrHint')}</p>

            <div className="flex w-full flex-col gap-2">
              <Button size="lg" fullWidth leftIcon={<Share2 size={18} aria-hidden="true" />} onClick={() => void share()}>
                {t('cohost.shareLink')}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" leftIcon={<Link2 size={16} aria-hidden="true" />} onClick={() => void copyText(link).then(() => toast.success(t('common.copied')))}>
                  {t('cohost.copyLink')}
                </Button>
                <Button variant="secondary" loading={busy} leftIcon={<RefreshCw size={16} aria-hidden="true" />} onClick={() => void issue()}>
                  {t('cohost.renewCode')}
                </Button>
              </div>
              <Button
                variant="ghost"
                className="text-danger"
                onClick={() => {
                  sessionRepo.revokeJoinCode(active.id, active.joinCode);
                  setJoinCode(null, null);
                }}
              >
                {t('cohost.disableCode')}
              </Button>
            </div>
          </>
        ) : (
          <EmptyState art="court" title={t('cohost.noCode')} body={t('cohost.noCodeBody')} action={<Button loading={busy} disabled={!online} onClick={() => void issue()}>{t('cohost.createCode')}</Button>} />
        )}

        <section className="w-full" aria-labelledby="devices">
          <h2 id="devices" className="mb-2 text-[17px] font-bold">
            {t('cohost.connectedDevices')}
          </h2>
          {coHosts.length === 0 ? (
            <p className="text-[14px] text-ink-faint">{t('cohost.noDevices')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {coHosts.map((c) => {
                const fresh = now - c.lastSeenAt < 90_000;
                return (
                  <li key={c.id} className="flex min-h-12 items-center gap-3 rounded-md border border-line bg-surface px-3">
                    <Smartphone size={18} className="text-ink-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{c.label}</span>
                    <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-semibold', fresh ? 'text-success' : 'text-ink-faint')}>
                      <span aria-hidden="true" className={cn('size-2 rounded-full', fresh ? 'bg-success' : 'bg-ink-faint')} />
                      {fresh ? t('cohost.online') : t('cohost.idle')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
