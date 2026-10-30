import { useMemo, useState } from 'react';
import { Check, Search, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { SkeletonRows } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { TierBadge } from '@/components/TierBadge';
import { cn } from '@/components/cn';
import { filterPlayers, sortPlayers } from '@/core/roster/view';
import { initialsOf } from '@/core/utils/avatar';
import { rosterRepo } from '@/data/hostRosterRepo';
import { allSports, sportAccent } from '@/features/shared/sportMeta';
import { useSetupDraft } from '@/features/shared/people';
import { useAppStore } from '@/state/appStore';
import { useRosterStore } from '@/state/rosterStore';
import type { SportId } from '@/types/sport';

function GuestSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (name: string) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title={t('session.setup.guestTitle')} closeLabel={t('common.close')}>
      {open ? (
        <form
          className="flex flex-col gap-4 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            const clean = name.trim();
            if (!clean) return;
            onAdd(clean);
            setName('');
            onClose();
          }}
        >
          <TextField label={t('roster.newPlayer.nameLabel')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('roster.newPlayer.namePlaceholder')} maxLength={40} autoComplete="off" />
          <p className="text-[13px] text-ink-faint">{t('session.setup.guestHint')}</p>
          <Button type="submit" size="lg" fullWidth disabled={name.trim().length === 0}>
            {t('session.setup.addGuestCta')}
          </Button>
        </form>
      ) : null}
    </Sheet>
  );
}

/** Step 1: sport + who is playing. Sorted by most recently played so regulars float to the top. */
export function SetupPlayersStep() {
  const { t } = useTranslation();
  const hostId = useAppStore((s) => s.hostId);
  const players = useRosterStore((s) => s.players);
  const status = useRosterStore((s) => s.status);
  const sportId = useSetupDraft((s) => s.sportId) as SportId | null;
  const selected = useSetupDraft((s) => s.playerIds);
  const patch = useSetupDraft((s) => s.patch);
  const [query, setQuery] = useState('');
  const [guestOpen, setGuestOpen] = useState(false);

  const visible = useMemo(
    () => sortPlayers(filterPlayers(players, { query, showArchived: false }), 'lastPlayed', sportId),
    [players, query, sportId],
  );
  const selectedSet = new Set(selected);
  const allSelected = visible.length > 0 && visible.every((p) => selectedSet.has(p.id));

  const toggle = (id: string) => patch({ playerIds: selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id] });

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="setup-sport">
        <h2 id="setup-sport" className="mb-2 text-[17px] font-bold">
          {t('session.setup.selectSport')}
        </h2>
        <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-labelledby="setup-sport">
          {allSports().map((s) => (
            <Chip key={s.id} selected={sportId === s.id} accent={sportAccent(s.id)} onClick={() => patch({ sportId: s.id, config: {}, courtCount: null, courtLabels: [] })}>
              {t(s.nameKey)}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-labelledby="setup-players">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="setup-players" className="text-[17px] font-bold">
            {t('session.setup.selectPlayers')}
          </h2>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => patch({ playerIds: allSelected ? selected.filter((id) => !visible.some((p) => p.id === id)) : [...new Set([...selected, ...visible.map((p) => p.id)])] })} disabled={visible.length === 0}>
              {allSelected ? t('session.setup.deselectAll') : t('session.setup.selectAll')}
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<UserPlus size={16} aria-hidden="true" />} onClick={() => setGuestOpen(true)}>
              {t('session.setup.addGuest')}
            </Button>
          </div>
        </div>

        <div className="relative mb-2">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('roster.searchPlaceholder')}
            aria-label={t('roster.searchPlaceholder')}
            className="min-h-12 w-full rounded-md border border-line bg-surface-2 pl-11 pr-4 outline-none focus:border-line-strong"
          />
        </div>

        {status !== 'ready' ? (
          <SkeletonRows count={5} />
        ) : players.length === 0 ? (
          <EmptyState art="players" title={t('roster.empty.title')} body={t('session.setup.emptyRoster')} action={<Button onClick={() => setGuestOpen(true)}>{t('session.setup.addGuest')}</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState art="search" title={t('roster.noResults.title')} body={t('roster.noResults.body', { query })} />
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label={t('session.setup.selectPlayers')}>
            {visible.map((p) => {
              const on = selectedSet.has(p.id);
              const sum = sportId ? p.summary[sportId] : undefined;
              return (
                <li key={p.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_56px]">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(p.id)}
                    className={cn('pressable no-select flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 text-left', on ? 'border-primary bg-surface-2' : 'border-line bg-surface')}
                  >
                    <span className={cn('grid size-6 shrink-0 place-items-center rounded-sm border-2 transition-colors duration-150', on ? 'border-primary bg-primary text-primary-on' : 'border-line-strong')} aria-hidden="true">
                      {on ? <Check size={16} strokeWidth={3} /> : null}
                    </span>
                    <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{p.nickname || p.name}</span>
                      {p.isGuest ? <span className="block text-[12px] text-ink-muted">{t('roster.guestTag')}</span> : null}
                    </span>
                    {sum ? <TierBadge tier={sum.tier} division={sum.division} stars={sum.stars} size="sm" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <GuestSheet
        open={guestOpen}
        onClose={() => setGuestOpen(false)}
        onAdd={(name) => {
          if (!hostId) return;
          const guest = rosterRepo.create(hostId, { name, isGuest: true });
          patch({ playerIds: [...new Set([...selected, guest.id])] });
        }}
      />

    </div>
  );
}
