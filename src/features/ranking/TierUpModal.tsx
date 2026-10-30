import { useEffect, useId } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { StarTrack } from '@/components/StarTrack';
import { TierBadge } from '@/components/TierBadge';
import { haptic } from '@/components/haptics';
import { useModalDialog } from '@/components/useModalDialog';
import type { TierKey } from '@/types/rank';

export interface TierUpItem {
  key: string;
  name: string;
  from: { tier: TierKey; division: number };
  to: { tier: TierKey; division: number; stars: number };
}

type Props = {
  item: TierUpItem | null;
  index: number;
  total: number;
  onNext: () => void;
  onSkipAll: () => void;
  onShare: () => void;
};

const RAYS = Array.from({ length: 14 }, (_, i) => i);

/**
 * One celebration, then out of the way (docs/design.md §7.3): badge morphs old -> new with a spring,
 * a short star burst, a settle. About 1.8 s. Queued sequentially; "Lewati semua" appears from the
 * second one on. Reduced motion: a static card, haptics only.
 */
export function TierUpModal({ item, index, total, onNext, onSkipAll, onShare }: Props) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const { ref, visible } = useModalDialog(item !== null, onNext);
  const titleId = useId();

  useEffect(() => {
    if (!item) return;
    haptic('success');
    const id = setTimeout(() => haptic('success'), 180);
    return () => clearTimeout(id);
  }, [item]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 hidden h-full max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-transparent open:grid open:place-items-center"
    >
      <button
        type="button"
        aria-label={t('common.next')}
        onClick={onNext}
        className="absolute inset-0 bg-[var(--c-overlay)] transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      />
      <AnimatePresence mode="wait">
        {item ? (
          <motion.div
            key={item.key}
            className="pointer-events-none relative flex w-full max-w-[420px] flex-col items-center gap-3 px-6 text-center"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <p className="num text-[13px] font-semibold text-ink-muted">{total > 1 ? t('board.tierUpCounter', { n: index + 1, total }) : ' '}</p>
            <h2 id={titleId} className="text-[18px] font-bold text-ink-muted">
              {t('board.tierUpFor', { name: item.name })}
            </h2>

            <div className="relative grid size-48 place-items-center">
              {!reduced
                ? RAYS.map((i) => {
                    const angle = (i / RAYS.length) * Math.PI * 2;
                    return (
                      <motion.span
                        key={i}
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 size-2 rounded-full"
                        style={{ backgroundColor: `var(--tier-${item.to.tier})`, marginLeft: -4, marginTop: -4 }}
                        initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                        animate={{ opacity: [0, 1, 0], x: Math.cos(angle) * 104, y: Math.sin(angle) * 104, scale: [0.4, 1, 0.6] }}
                        transition={{ delay: 0.5, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                      />
                    );
                  })
                : null}

              <motion.div
                className="absolute"
                initial={{ opacity: 1, scale: 1 }}
                animate={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.82 }}
                transition={{ delay: 0.28, duration: 0.22, ease: 'easeOut' }}
                aria-hidden="true"
              >
                <TierBadge tier={item.from.tier} division={item.from.division} size="lg" />
              </motion.div>
              <motion.div
                className="absolute"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduced ? { delay: 0.3, duration: 0.2 } : { delay: 0.45, type: 'spring', duration: 0.6, bounce: 0.3 }}
              >
                <TierBadge tier={item.to.tier} division={item.to.division} stars={item.to.stars} size="hero" />
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0.3 : 1.0, duration: 0.3, ease: [0.23, 1, 0.32, 1] }} className="flex flex-col items-center gap-2">
              <p className="text-[34px] font-extrabold leading-none" style={{ color: `var(--tier-${item.to.tier})` }}>
                {t(`rank.tier.${item.to.tier}`)}
              </p>
              {item.to.tier !== 'mythic' ? <StarTrack tier={item.to.tier} filled={item.to.stars} size={22} /> : null}
            </motion.div>

            <motion.div
              className="pointer-events-auto mt-4 flex w-full flex-col gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduced ? 0.4 : 1.4, duration: 0.25 }}
            >
              <Button size="lg" fullWidth leftIcon={<Share2 size={18} aria-hidden="true" />} onClick={onShare}>
                {t('common.share')}
              </Button>
              <Button variant="secondary" fullWidth onClick={onNext}>
                {index + 1 < total ? t('common.next') : t('common.done')}
              </Button>
              {index >= 1 && total - index > 1 ? (
                <Button variant="ghost" fullWidth onClick={onSkipAll}>
                  {t('session.finish.skipAll')}
                </Button>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </dialog>
  );
}
