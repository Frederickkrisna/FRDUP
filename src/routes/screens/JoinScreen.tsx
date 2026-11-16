import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { JoinCodeExpiredError, JoinCodeInvalidError } from '@/core/matchmaking/errors';
import { JOIN_CODE_LENGTH, extractJoinCode, normalizeJoinCode } from '@/core/session/joinCode';
import { ensureGuestUid } from '@/data/authRepo';
import { roundRepo, sessionRepo } from '@/data/sessionRepo';
import { deviceLabel } from '@/features/shared/people';
import { useBootStore } from '@/state/bootStore';
import { useSessionStore } from '@/state/sessionStore';
import { useSyncStore } from '@/state/syncStore';

type Phase = { kind: 'idle' } | { kind: 'joining' } | { kind: 'error'; key: string };

/** Co-host entry: 6 single-character inputs with auto-advance, paste + clipboard detect, deep link. */
export function JoinScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code: routeCode } = useParams();
  const uid = useBootStore((s) => s.uid);
  const online = useSyncStore((s) => s.online);
  const joinAsCoHost = useSessionStore((s) => s.joinAsCoHost);
  const hasOwn = useSessionStore((s) => s.session !== null && s.role === 'host' && (s.session.status === 'live' || s.session.status === 'paused'));
  const initial = extractJoinCode(routeCode ?? '') ?? '';

  const [chars, setChars] = useState<string[]>(() => Array.from({ length: JOIN_CODE_LENGTH }, (_, i) => initial[i] ?? ''));
  const [label, setLabel] = useState(deviceLabel());
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const autoTried = useRef(false);

  const code = chars.join('');
  const complete = code.length === JOIN_CODE_LENGTH;

  const setAll = (value: string) => {
    const clean = normalizeJoinCode(value).slice(0, JOIN_CODE_LENGTH);
    setChars(Array.from({ length: JOIN_CODE_LENGTH }, (_, i) => clean[i] ?? ''));
    refs.current[Math.min(clean.length, JOIN_CODE_LENGTH - 1)]?.focus();
  };

  const join = async (value: string) => {
    setPhase({ kind: 'joining' });
    try {
      // A phone that only scanned the QR has no account: join as a silent guest.
      const me = uid ?? (await ensureGuestUid());
      if (!uid) useBootStore.setState({ uid: me });
      const session = await sessionRepo.resolveJoinCode(value);
      await sessionRepo.attachCoHost(session.id, { id: me, sessionId: session.id, label: label.trim() || deviceLabel(), joinedAt: Date.now(), claimedCourtIds: [], lastSeenAt: Date.now() });
      const rounds = await roundRepo.listBySession(session.id);
      joinAsCoHost(session, rounds, []);
      void navigate(`/session/${session.id}/courts`, { replace: true });
    } catch (error) {
      const key =
        error instanceof JoinCodeInvalidError
          ? 'error.joinCodeInvalid'
          : error instanceof JoinCodeExpiredError
            ? 'error.joinCodeExpired'
            : !navigator.onLine
              ? 'error.offline'
              : (error as { code?: string }).code === 'permission-denied'
                ? 'error.joinCodeExpired'
                : 'error.generic';
      setPhase({ kind: 'error', key });
    }
  };

  // Deep link /join/ABC234: resolve straight away.
  useEffect(() => {
    if (autoTried.current || !initial || !online) return;
    autoTried.current = true;
    void join(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, online]);

  const onKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[i]) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft') refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight') refs.current[i + 1]?.focus();
    if (e.key === 'Enter' && complete) void join(code);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setAll(extractJoinCode(e.clipboardData.getData('text')) ?? e.clipboardData.getData('text'));
  };

  const readClipboard = async () => {
    try {
      const found = extractJoinCode(await navigator.clipboard.readText());
      if (found) setAll(found);
      else setPhase({ kind: 'error', key: 'cohost.clipboardEmpty' });
    } catch {
      setPhase({ kind: 'error', key: 'cohost.clipboardDenied' });
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <ScreenHeader title={t('cohost.joinTitle')} subtitle={t('cohost.joinSubtitle')} onBack={() => void navigate('/')} backLabel={t('common.back')} />
      <main className="flex flex-1 flex-col gap-6 px-4 pb-8 pt-8">
        {hasOwn ? <p role="alert" className="rounded-md border border-warning/60 bg-surface p-3 text-[13px] text-warning">{t('cohost.ownSessionWarning')}</p> : null}

        <div role="group" aria-label={t('cohost.joinTitle')} className="flex justify-between gap-2">
          {chars.map((ch, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={ch}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={1}
              aria-label={t('cohost.charLabel', { n: i + 1, total: JOIN_CODE_LENGTH })}
              onPaste={onPaste}
              onKeyDown={onKey(i)}
              onChange={(e) => {
                const v = normalizeJoinCode(e.target.value).slice(-1);
                setChars((prev) => prev.map((c, j) => (j === i ? v : c)));
                if (v && i < JOIN_CODE_LENGTH - 1) refs.current[i + 1]?.focus();
                if (phase.kind === 'error') setPhase({ kind: 'idle' });
              }}
              onFocus={(e) => e.target.select()}
              className="num h-16 w-full min-w-0 rounded-md border border-line bg-surface-2 text-center text-[28px] font-bold uppercase outline-none focus:border-primary"
            />
          ))}
        </div>

        <Button variant="secondary" leftIcon={<ClipboardPaste size={18} aria-hidden="true" />} onClick={() => void readClipboard()}>
          {t('cohost.pasteFromClipboard')}
        </Button>

        <TextField label={t('cohost.deviceName')} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={24} hint={t('cohost.deviceNameHint')} autoComplete="off" />

        <div aria-live="polite" className="min-h-6">
          {phase.kind === 'error' ? <p role="alert" className="text-[14px] text-danger">{t(phase.key)}</p> : null}
          {!online ? <p className="text-[14px] text-warning">{t('cohost.needsOnline')}</p> : null}
        </div>

        <Button size="lg" fullWidth className="mt-auto" disabled={!complete || !online} loading={phase.kind === 'joining'} onClick={() => void join(code)}>
          {phase.kind === 'joining' ? t('cohost.joining') : t('cohost.joinCta')}
        </Button>
      </main>
    </div>
  );
}
