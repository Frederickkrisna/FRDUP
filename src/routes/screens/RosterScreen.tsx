import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SkeletonRows } from '@/components/Skeleton';
import { filterPlayers, sortPlayers, type RosterSort } from '@/core/roster/view';
import { PlayerFormSheet } from '@/features/roster/PlayerFormSheet';
import { PlayerRow } from '@/features/roster/PlayerRow';
import { allSports, sportAccent } from '@/features/shared/sportMeta';
import { useAppStore } from '@/state/appStore';
import { useRosterStore } from '@/state/rosterStore';
import type { SportId } from '@/types/sport';

export function RosterScreen() {
  const { t } = useTranslation();
  const hostId = useAppStore((s) => s.hostId);
  const lastSport = useAppStore((s) => s.lastSportId);
  const players = useRosterStore((s) => s.players);
  const status = useRosterStore((s) => s.status);
  const start = useRosterStore((s) => s.start);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RosterSort>('name');
  const [showArchived, setShowArchived] = useState(false);
  const [sportId, setSportId] = useState<SportId | null>(lastSport);
  const [formOpen, setFormOpen] = useState(false);

  const visible = useMemo(
    () => sortPlayers(filterPlayers(players, { query, showArchived }), sort, sportId),
    [players, query, showArchived, sort, sportId],
  );

  const sportOptions = allSports();

  return (
    <div className="pt-safe px-4 pb-4">
      <header className="flex items-end justify-between pb-3 pt-6">
        <h1 className="text-[32px] font-extrabold leading-none">{t('roster.title')}</h1>
        <Button size="sm" leftIcon={<Plus size={18} aria-hidden="true" />} onClick={() => setFormOpen(true)}>
          {t('roster.addPlayer')}
        </Button>
      </header>

      <div className="relative">
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

      <div className="hide-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t('roster.filterSport')}>
        <Chip selected={sportId === null} onClick={() => setSportId(null)}>
          {t('common.allSports')}
        </Chip>
        {sportOptions.map((s) => (
          <Chip key={s.id} selected={sportId === s.id} accent={sportAccent(s.id)} onClick={() => setSportId(s.id)}>
            {t(s.nameKey)}
          </Chip>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <SegmentedControl<RosterSort>
          className="flex-1"
          ariaLabel={t('roster.sortBy')}
          value={sort}
          onChange={setSort}
          options={[
            { value: 'name', label: t('roster.sortName') },
            { value: 'lastPlayed', label: t('roster.sortLastPlayed') },
            { value: 'tier', label: t('roster.sortTier') },
          ]}
        />
        <Chip selected={showArchived} onClick={() => setShowArchived((v) => !v)}>
          {t('roster.archived')}
        </Chip>
      </div>

      <section className="mt-4" aria-busy={status === 'loading'}>
        {status === 'loading' || status === 'idle' ? (
          <SkeletonRows count={6} />
        ) : status === 'error' ? (
          <EmptyState art="players" title={t('roster.error.title')} body={t('roster.error.body')} action={<Button onClick={() => hostId && start(hostId)}>{t('common.retry')}</Button>} />
        ) : players.length === 0 ? (
          <EmptyState art="players" title={t('roster.empty.title')} body={t('roster.empty.subtitle')} action={<Button fullWidth onClick={() => setFormOpen(true)}>{t('roster.addPlayer')}</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState art="search" title={t('roster.noResults.title')} body={t('roster.noResults.body', { query })} />
        ) : (
          <ul className="flex flex-col">
            {visible.map((p, i) => (
              <PlayerRow key={p.id} player={p} sportId={sportId} index={i} />
            ))}
          </ul>
        )}
      </section>

      {hostId ? <PlayerFormSheet open={formOpen} onClose={() => setFormOpen(false)} hostId={hostId} player={null} /> : null}
    </div>
  );
}
