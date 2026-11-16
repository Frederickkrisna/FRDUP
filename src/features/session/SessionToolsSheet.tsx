import { useState } from 'react';
import { Flag, UserMinus, UserPlus, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { toast } from '@/components/toast/toastStore';
import { cn } from '@/components/cn';
import { LIMITS } from '@/core/session/sessionEngine';
import { initialsOf } from '@/core/utils/avatar';
import { displayName, participantFromPlayer } from '@/features/shared/people';
import { useRosterStore } from '@/state/rosterStore';
import { useSessionStore } from '@/state/sessionStore';

function Toggle({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      // 44px tap area around a 32px track; the knob is anchored left so it never drifts to the centre.
      className="pressable relative -my-1.5 grid h-11 w-16 shrink-0 place-items-center disabled:opacity-40"
    >
      <span aria-hidden="true" className="relative block h-8 w-14 rounded-full border border-line transition-colors duration-200" style={{ backgroundColor: on ? 'var(--c-primary)' : 'var(--c-surface-3)' }}>
        <span className={cn('absolute left-0 top-[3px] size-6 rounded-full transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none', on ? 'translate-x-[27px] bg-primary-on' : 'translate-x-[3px] bg-ink-muted')} />
      </span>
    </button>
  );
}

/** Host tools while a session runs: players coming and going, courts on/off, details, finish/abandon. */
export function SessionToolsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const setCourtActive = useSessionStore((s) => s.setCourtActive);
  const addParticipant = useSessionStore((s) => s.addParticipant);
  const removeParticipant = useSessionStore((s) => s.removeParticipant);
  const setTitleVenue = useSessionStore((s) => s.setTitleVenue);
  const abandon = useSessionStore((s) => s.abandonSession);
  const roster = useRosterStore((s) => s.players);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [adding, setAdding] = useState(false);

  if (!session) return null;
  const present = session.participants.filter((p) => p.leftAtRound === null);
  const left = session.participants.filter((p) => p.leftAtRound !== null);
  const known = new Set(present.map((p) => p.playerId));
  const candidates = roster.filter((p) => p.archivedAt === null && !known.has(p.id));
  const activeCount = session.courts.filter((c) => c.isActive).length;

  const toggleCourt = (courtId: string, label: string, active: boolean) => {
    const res = setCourtActive(courtId, active);
    if (!res.ok) {
      if (res.error === 'last_court') toast.warning(t('session.tools.lastCourt'));
      return;
    }
    const key = active ? (res.appliedNow ? 'courtOnNow' : 'courtOnNext') : res.appliedNow ? 'courtOffNow' : 'courtOffNext';
    toast.info(t(`session.tools.${key}`, { court: label }));
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('session.tools.title')} closeLabel={t('common.close')}>
      {open ? (
        <div className="flex flex-col gap-6 pb-4">
          <section className="flex flex-col gap-3" aria-label={t('session.setup.detailsTitle')}>
            <TextField label={t('session.setup.titleLabel')} defaultValue={session.title ?? ''} onBlur={(e) => setTitleVenue({ title: e.target.value.trim() || null })} maxLength={50} autoComplete="off" />
            <TextField label={t('session.setup.venueLabel')} defaultValue={session.venue ?? ''} onBlur={(e) => setTitleVenue({ venue: e.target.value.trim() || null })} maxLength={50} autoComplete="off" />
          </section>

          <section aria-labelledby="tools-courts">
            <h3 id="tools-courts" className="mb-2 text-[17px] font-bold">
              {t('session.tools.courts')}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {session.courts.map((c) => (
                <li key={c.id} className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3">
                  <div className="min-w-0">
                    <p className={cn('truncate text-[15px] font-semibold', !c.isActive && 'text-ink-muted')}>{c.label}</p>
                    <p className="text-[12px] text-ink-faint">{c.isActive ? t('session.tools.courtOn') : t('session.tools.courtOff')}</p>
                  </div>
                  <Toggle on={c.isActive} disabled={c.isActive && activeCount <= 1} label={t('session.tools.courtActive', { court: c.label })} onChange={(v) => toggleCourt(c.id, c.label, v)} />
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[12px] text-ink-faint">{t('session.tools.courtsHint')}</p>
          </section>

          <section aria-labelledby="tools-players">
            <div className="mb-2 flex items-center justify-between">
              <h3 id="tools-players" className="text-[17px] font-bold">
                {t('session.tools.players', { count: present.length })}
              </h3>
              <Button size="sm" variant="secondary" disabled={present.length >= LIMITS.participants} leftIcon={<UserPlus size={16} aria-hidden="true" />} onClick={() => setAdding((v) => !v)}>
                {t('session.tools.addPlayer')}
              </Button>
            </div>

            {adding ? (
              <ul className="mb-3 flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-md border border-line p-1.5" aria-label={t('session.tools.addPlayer')}>
                {candidates.length === 0 ? <li className="p-3 text-[14px] text-ink-faint">{t('session.court.noOutsiders')}</li> : null}
                {candidates.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="pressable flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left"
                      onClick={() => {
                        addParticipant(participantFromPlayer(p));
                        toast.success(t('session.tools.playerAdded', { name: displayName(p) }));
                        setAdding(false);
                      }}
                    >
                      <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} size="xs" />
                      <span className="truncate text-[15px] font-semibold">{displayName(p)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <ul className="flex flex-col gap-1.5">
              {present.map((p) => (
                <li key={p.playerId} className="flex min-h-12 items-center gap-3 rounded-md border border-line bg-surface-2 px-3">
                  <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{displayName(p)}</span>
                  <button
                    type="button"
                    disabled={present.length <= 2}
                    onClick={() => {
                      removeParticipant(p.playerId);
                      toast.success(t('session.tools.playerLeft', { name: displayName(p) }));
                    }}
                    aria-label={t('session.tools.removePlayer', { name: displayName(p) })}
                    className="pressable grid size-11 place-items-center rounded-full text-ink-muted disabled:opacity-30"
                  >
                    <UserMinus size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {left.length > 0 ? <p className="mt-2 text-[12px] text-ink-faint">{t('session.tools.leftList', { names: left.map((p) => displayName(p)).join(', ') })}</p> : null}
          </section>

          <section className="flex flex-col gap-2">
            <Button
              size="lg"
              fullWidth
              leftIcon={<Flag size={18} aria-hidden="true" />}
              onClick={() => {
                onClose();
                void navigate(`/session/${session.id}/finish`);
              }}
            >
              {t('session.tools.finish')}
            </Button>
            <Button variant="ghost" fullWidth className="text-danger" leftIcon={<XCircle size={18} aria-hidden="true" />} onClick={() => setConfirmAbandon(true)}>
              {t('session.tools.abandon')}
            </Button>
          </section>

          <ConfirmDialog
            open={confirmAbandon}
            destructive
            title={t('session.tools.abandonConfirm')}
            body={t('session.tools.abandonDetail')}
            confirmLabel={t('session.tools.abandon')}
            cancelLabel={t('common.cancel')}
            onCancel={() => setConfirmAbandon(false)}
            onConfirm={() => {
              abandon();
              setConfirmAbandon(false);
              onClose();
              void navigate('/home', { replace: true });
            }}
          />
        </div>
      ) : null}
    </Sheet>
  );
}
