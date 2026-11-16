import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Flag, Link2, Pencil, Share2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Podium, type PodiumItem } from '@/components/Podium';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TierBadge } from '@/components/TierBadge';
import { cn } from '@/components/cn';
import { toast } from '@/components/toast/toastStore';
import { unsettledMatchCount } from '@/core/session/finish';
import { initialsOf } from '@/core/utils/avatar';
import { sessionCardData, tierUpCardData } from '@/features/export/cardData';
import { ExportSheet, TierUpExport } from '@/features/export/ExportSheet';
import { TierUpModal, type TierUpItem } from '@/features/ranking/TierUpModal';
import { displayName } from '@/features/shared/people';
import { useStandings } from '@/features/session/selectors';
import { useAppStore } from '@/state/appStore';
import { useSessionStore } from '@/state/sessionStore';
import { flushNow } from '@/state/sync';
import { publicBoardRepo } from '@/data/publicBoardRepo';
import { publicUrl } from '@/features/shared/publicUrl';
import type { BoardEntry } from '@/types/publicBoard';
import type { RankChange } from '@/core/session/finish';

export function FinishScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const hostId = useAppStore((s) => s.hostId);
  const noteFinished = useAppStore((s) => s.noteSessionFinished);
  const session = useSessionStore((s) => s.session);
  const rounds = useSessionStore((s) => s.rounds);
  const role = useSessionStore((s) => s.role);
  const finish = useSessionStore((s) => s.finish);
  const finishSession = useSessionStore((s) => s.finishSession);
  const voidAll = useSessionStore((s) => s.voidAllUnsettled);
  const reopenFinished = useSessionStore((s) => s.reopenFinished);
  const leave = useSessionStore((s) => s.leave);
  const standings = useStandings();

  const [confirm, setConfirm] = useState<'finish' | 'reopen' | null>(null);
  const [busy, setBusy] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [shareBoard, setShareBoard] = useState(false);
  const [shareTier, setShareTier] = useState<RankChange | null>(null);
  const [sharingPublic, setSharingPublic] = useState(false);
  const [publicBoardId, setPublicBoardId] = useState<string | null>(null);

  const unsettled = unsettledMatchCount(rounds);
  const done = session?.rankingApplied === true;

  // The tier-up queue is derived: promotions from the commit, minus whatever the user skipped.
  const queue: RankChange[] = done && finish && !skipped ? finish.promotions : [];

  const byId = useMemo(() => new Map((session?.participants ?? []).map((p) => [p.playerId, p])), [session?.participants]);
  const board = useMemo(
    () => (session && finish ? sessionCardData({ session, standings: finish.standings, changes: finish.changes, t }) : null),
    [session, finish, t],
  );

  if (!session || session.id !== sessionId) return <EmptyState art="court" title={t('session.notFound.title')} action={<Button onClick={() => void navigate('/home', { replace: true })}>{t('error.route.home')}</Button>} />;
  if (role !== 'host') return <EmptyState art="court" title={t('session.finish.hostOnly')} action={<Button onClick={() => void navigate(-1)}>{t('common.back')}</Button>} />;

  const doFinish = async () => {
    if (!hostId) return;
    setBusy(true);
    try {
      await finishSession(hostId);
      noteFinished();
      setConfirm(null);
    } catch {
      toast.danger(t('session.finish.failed'));
    } finally {
      setBusy(false);
    }
  };

  const doReopen = async () => {
    if (!hostId) return;
    setBusy(true);
    try {
      await reopenFinished(hostId);
      setConfirm(null);
      void navigate(`/session/${session.id}/courts`, { replace: true });
    } catch {
      toast.danger(t('session.finish.failed'));
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    await flushNow();
    leave();
    void navigate('/home', { replace: true });
  };

  const handleSharePublicLink = async () => {
    if (!session || !finish) return;
    setSharingPublic(true);
    try {
      let bId = publicBoardId;
      if (!bId) {
        const entries: BoardEntry[] = finish.standings.map((s) => {
          const p = byId.get(s.playerId);
          const change = finish.changes.find((c) => c.playerId === s.playerId);
          return {
            playerId: s.playerId,
            name: p ? displayName(p) : '?',
            nickname: p?.nickname ?? null,
            avatarColor: p?.avatarColor ?? 'transparent',
            rank: s.rank,
            matchesPlayed: s.matchesPlayed,
            wins: s.wins,
            pointsFor: s.pointsFor,
            pointsAgainst: s.pointsAgainst,
            pointDiff: s.pointDiff,
            winRate: s.winRate,
            rpDelta: change?.delta ?? 0,
            tierAfter: change?.to.tier ?? 'warrior',
            divisionAfter: change?.to.division ?? 1,
          };
        });

        bId = publicBoardRepo.publish({
          hostId: session.hostId,
          sessionId: session.id,
          sportId: session.sportId,
          title: session.title,
          venue: session.venue,
          playedAt: session.playedAt,
          entries,
        });
        setPublicBoardId(bId);
      }

      const shareUrl = publicUrl(`/board/${bId}`);
      if (navigator.share) {
        try {
          await navigator.share({
            title: session.title || t('session.finish.shareLinkTitle'),
            url: shareUrl,
          });
          toast.success(t('session.finish.linkShared'));
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('session.finish.linkCopied'));
    } catch {
      toast.danger(t('session.finish.shareFailed'));
    } finally {
      setSharingPublic(false);
    }
  };

  const current = queue[qIndex] ?? null;
  const currentItem: TierUpItem | null =
    current && !shareTier
      ? {
          key: current.playerId,
          name: byId.get(current.playerId) ? displayName(byId.get(current.playerId) as NonNullable<ReturnType<typeof byId.get>>) : '',
          from: { tier: current.from.tier, division: current.from.division },
          to: { tier: current.to.tier, division: current.to.division, stars: current.to.stars },
        }
      : null;
  const advance = () => {
    if (qIndex + 1 < queue.length) setQIndex(qIndex + 1);
    else setSkipped(true);
  };

  const podium: PodiumItem[] = finish
    ? finish.podium.slice(0, 3).map((id, i) => {
        const p = byId.get(id);
        const row = finish.standings.find((s) => s.playerId === id);
        const change = finish.changes.find((c) => c.playerId === id);
        return {
          key: id,
          rank: (i + 1) as 1 | 2 | 3,
          name: p ? displayName(p) : '?',
          initials: initialsOf(p?.name ?? '?'),
          color: p?.avatarColor ?? 'transparent',
          src: p?.avatarUrl,
          value: `${row?.pointsFor ?? 0} ${t('session.finish.pointsShort')}`,
          badge: change ? <TierBadge tier={change.to.tier} division={change.to.division} stars={change.to.stars} size="sm" /> : undefined,
        };
      })
    : [];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[560px] pb-32">
      <ScreenHeader title={done ? t('session.finish.doneTitle') : t('session.finish.title')} onBack={() => void navigate(`/session/${session.id}/courts`)} backLabel={t('common.back')} />

      {!done ? (
        <main className="flex flex-col gap-5 px-4 pt-6">
          {unsettled > 0 ? (
            <section role="alert" className="rounded-lg border border-warning/60 bg-surface p-4">
              <p className="text-[17px] font-bold text-warning">{t('session.finish.incompleteMatches', { count: unsettled })}</p>
              <p className="mt-1 text-[14px] text-ink-muted">{t('session.finish.incompleteHint')}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => void navigate(`/session/${session.id}/courts`)}>
                  {t('session.finish.backToCourts')}
                </Button>
                <Button variant="ghost" className="text-danger" onClick={voidAll}>
                  {t('session.finish.voidRemaining')}
                </Button>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-line bg-surface p-4">
              <p className="text-[17px] font-bold">{t('session.finish.readyTitle')}</p>
              <p className="mt-1 text-[14px] text-ink-muted">{t('session.finish.readyBody', { rounds: rounds.length, players: session.participants.length })}</p>
            </section>
          )}
          <Button size="lg" fullWidth disabled={unsettled > 0} leftIcon={<Flag size={18} aria-hidden="true" />} onClick={() => setConfirm('finish')}>
            {t('session.finish.cta')}
          </Button>
        </main>
      ) : (
        <main className="flex flex-col gap-6 px-4 pt-6">
          {podium.length > 0 ? (
            <section aria-labelledby="fin-podium">
              <h2 id="fin-podium" className="mb-3 text-[20px] font-extrabold">
                {t('session.finish.podium')}
              </h2>
              <Podium items={podium} rankLabel={(r) => t('board.rankLabel', { rank: r })} />
            </section>
          ) : (
            <EmptyState art="chart" title={t('session.finish.noRanking')} body={t('session.finish.noRankingBody')} />
          )}

          {finish && finish.changes.length > 0 ? (
            <section aria-labelledby="fin-rp">
              <h2 id="fin-rp" className="mb-1 text-[20px] font-extrabold">
                {t('session.finish.rpDelta')}
              </h2>
              <p className="mb-3 text-[13px] text-ink-muted">{t('session.finish.rpHint')}</p>
              <ul className="flex flex-col gap-1.5">
                {finish.changes.map((c) => {
                  const p = byId.get(c.playerId);
                  const sRow = finish.standings.find((s) => s.playerId === c.playerId);
                  const open = openRow === c.playerId;
                  return (
                    <li key={c.playerId} className="overflow-hidden rounded-lg border border-line bg-surface">
                      <button type="button" aria-expanded={open} onClick={() => setOpenRow(open ? null : c.playerId)} className="pressable flex min-h-14 w-full items-center gap-3 px-3 text-left">
                        <span className="num w-6 text-center text-[16px] font-bold text-ink-muted">{c.rank}</span>
                        {p ? <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} src={p.avatarUrl} size="xs" /> : null}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[16px] font-semibold leading-tight">{p ? displayName(p) : '?'}</p>
                          {sRow ? (
                            <p className="num text-[12px] text-ink-muted">
                              {t('session.finish.playerStats', { points: sRow.pointsFor, wins: sRow.wins, losses: sRow.losses })}
                            </p>
                          ) : null}
                        </div>
                        <span className={cn('num shrink-0 text-[16px] font-bold', c.delta > 0 ? 'text-success' : c.delta < 0 ? 'text-danger' : 'text-ink-muted')}>
                          {c.delta > 0 ? `+${c.delta}` : c.delta === 0 ? t('session.finish.noChange') : c.delta}
                        </span>
                        <TierBadge tier={c.to.tier} division={c.to.division} size="sm" />
                        <ChevronDown size={16} className={cn('shrink-0 text-ink-faint transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
                      </button>
                      {open ? (
                        <dl className="num grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line px-4 py-3 text-[14px]">
                          <dt className="text-ink-muted">{t('session.finish.breakdown.placement')}</dt>
                          <dd className="text-right">{c.breakdown.placement}</dd>
                          <dt className="text-ink-muted">{t('session.finish.breakdown.winRate')}</dt>
                          <dd className="text-right">{c.breakdown.winRate}</dd>
                          <dt className="text-ink-muted">{t('session.finish.breakdown.pointDiff')}</dt>
                          <dd className="text-right">{c.breakdown.pointDiff}</dd>
                          <dt className="text-ink-muted">{t('session.finish.breakdown.participation')}</dt>
                          <dd className="text-right">{c.breakdown.participation}</dd>
                          {c.floorProtected ? <dd className="col-span-2 text-[12px] text-ink-faint">{t('session.finish.floorProtected')}</dd> : null}
                        </dl>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {standings.some((s) => s.matchesPlayed > 0 && !byId.get(s.playerId)?.includeInRanking) ? <p className="text-[13px] text-ink-faint">{t('session.finish.guestsNote')}</p> : null}

          <section className="flex flex-col gap-2">
            <Button size="lg" fullWidth leftIcon={<Share2 size={18} aria-hidden="true" />} disabled={!board || board.entries.length === 0} onClick={() => setShareBoard(true)}>
              {t('session.finish.shareBoard')}
            </Button>
            <Button
              size="lg"
              fullWidth
              variant="secondary"
              leftIcon={<Link2 size={18} aria-hidden="true" />}
              loading={sharingPublic}
              disabled={!finish || finish.standings.length === 0}
              onClick={() => void handleSharePublicLink()}
            >
              {t('session.finish.shareLink')}
            </Button>
            <Button size="lg" fullWidth variant="secondary" leftIcon={<ArrowRight size={18} aria-hidden="true" />} onClick={() => void navigate(`/session/${session.id}/bill`)}>
              {t('session.finish.continueToBill')}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" leftIcon={<Pencil size={16} aria-hidden="true" />} onClick={() => setConfirm('reopen')}>
                {t('session.finish.editScores')}
              </Button>
              <Button variant="ghost" onClick={() => void close()}>
                {t('session.finish.closeSession')}
              </Button>
            </div>
          </section>
        </main>
      )}

      <ConfirmDialog
        open={confirm === 'finish'}
        title={t('session.finish.confirmTitle')}
        body={t('session.finish.confirmBody')}
        confirmLabel={t('session.finish.cta')}
        cancelLabel={t('common.cancel')}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void doFinish()}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        title={t('session.finish.reopenTitle')}
        body={t('session.finish.reopenBody')}
        confirmLabel={t('session.finish.editScores')}
        cancelLabel={t('common.cancel')}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void doReopen()}
      />

      <TierUpModal item={currentItem} index={qIndex} total={queue.length} onNext={advance} onSkipAll={() => setSkipped(true)} onShare={() => setShareTier(current)} />
      {board ? <ExportSheet open={shareBoard} onClose={() => setShareBoard(false)} data={board} /> : null}
      {shareTier ? (
        (() => {
          const data = tierUpCardData({ session, change: shareTier, t });
          return data ? <TierUpExport open onClose={() => setShareTier(null)} data={data} /> : null;
        })()
      ) : null}
    </div>
  );
}
