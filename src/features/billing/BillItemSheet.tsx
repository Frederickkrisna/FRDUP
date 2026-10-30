import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { CurrencyField } from '@/components/CurrencyField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { TextField } from '@/components/TextField';
import { cn } from '@/components/cn';
import { rentalCaption, rentalPayers } from '@/core/session/bill';
import { presetsFor, type BillPreset } from '@/core/session/billPresets';
import { createId } from '@/core/utils/id';
import { formatIdr } from '@/core/utils/idr';
import { displayName } from '@/features/shared/people';
import type { BillItem, BillItemKind } from '@/types/bill';
import type { SessionParticipant } from '@/types/session';
import type { SportId } from '@/types/sport';
import { initialsOf } from '@/core/utils/avatar';

type Props = {
  open: boolean;
  onClose: () => void;
  sportId: SportId;
  participants: SessionParticipant[];
  /** null => new item. */
  item: BillItem | null;
  onSave: (item: BillItem) => void;
  onDelete?: (id: string) => void;
};

const KINDS: BillItemKind[] = ['court_fee', 'shared', 'rental', 'individual'];

function PlayerToggles({ people, selected, onToggle, label }: { people: SessionParticipant[]; selected: Set<string>; onToggle: (id: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      {people.map((p) => {
        const on = selected.has(p.playerId);
        return (
          <button
            key={p.playerId}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(p.playerId)}
            className={cn('pressable no-select flex min-h-12 items-center gap-2 rounded-md border px-2 text-left', on ? 'border-primary bg-surface-3' : 'border-line bg-surface-2 text-ink-muted')}
          >
            <span className={cn('grid size-5 shrink-0 place-items-center rounded-sm border-2', on ? 'border-primary bg-primary text-primary-on' : 'border-line-strong')} aria-hidden="true">
              {on ? <Check size={12} strokeWidth={3.5} /> : null}
            </span>
            <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} size="xs" />
            <span className="truncate text-[14px] font-semibold">{displayName(p)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Form({ sportId, participants, item, onSave, onDelete, onClose }: Omit<Props, 'open'>) {
  const { t } = useTranslation();
  const billable = useMemo(() => participants.filter((p) => p.includeInBill), [participants]);
  const allIds = useMemo(() => billable.map((p) => p.playerId), [billable]);

  const [kind, setKind] = useState<BillItemKind>(item?.kind ?? 'court_fee');
  const [label, setLabel] = useState(item?.customLabel ?? '');
  const [price, setPrice] = useState(item?.unitPrice ?? 0);
  const [qty, setQty] = useState(item?.quantity ?? 1);
  const [payers, setPayers] = useState<Set<string>>(new Set(item?.payerPlayerIds ?? allIds));
  // Rental is modelled as exclusion: who brought their own gear.
  const [own, setOwn] = useState<Set<string>>(
    new Set(item?.kind === 'rental' ? allIds.filter((id) => !item.payerPlayerIds.includes(id)) : []),
  );
  const [tried, setTried] = useState(false);

  const presets = presetsFor(sportId);
  const rentalIds = rentalPayers(billable, [...own]);
  const effectivePayers = kind === 'rental' ? rentalIds : kind === 'court_fee' ? allIds : [...payers];
  const total = kind === 'individual' ? price * effectivePayers.length : price * qty;

  const applyPreset = (p: BillPreset) => {
    setKind(p.kind);
    setLabel(t(p.labelKey));
    setQty(p.quantity);
    if (p.kind === 'shared') setPayers(new Set(allIds));
  };

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void) => (id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const labelError = tried && label.trim().length === 0 ? t('bill.error.labelRequired') : null;
  const priceError = tried && price <= 0 ? t('bill.error.invalidAmount') : null;
  const payerError = tried && kind !== 'court_fee' && effectivePayers.length === 0 ? t('bill.error.noPayers') : null;

  const save = () => {
    setTried(true);
    if (label.trim().length === 0 || price <= 0 || (kind !== 'court_fee' && effectivePayers.length === 0)) return;
    onSave({
      id: item?.id ?? createId(),
      kind,
      labelKey: null,
      customLabel: label.trim(),
      unitPrice: price,
      quantity: kind === 'individual' ? effectivePayers.length : qty,
      payerPlayerIds: kind === 'court_fee' ? [] : effectivePayers,
    });
    onClose();
  };

  const caption = kind === 'rental' ? rentalCaption({ id: 'x', kind, labelKey: null, customLabel: null, unitPrice: price, quantity: qty, payerPlayerIds: rentalIds }) : null;

  return (
    <div className="flex flex-col gap-5 pb-2">
      {presets.length > 0 && !item ? (
        <section aria-label={t('bill.presets')}>
          <div className="hide-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {presets.map((p) => (
              <Chip key={p.id} onClick={() => applyPreset(p)} selected={label === t(p.labelKey)}>
                {t(p.labelKey)}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      <SegmentedControl<BillItemKind> ariaLabel={t('bill.itemKindLabel')} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t(`bill.itemKind.${k}`) }))} />
      <p className="-mt-3 text-[12px] text-ink-faint">{t(`bill.itemKindHint.${kind}`)}</p>

      <TextField label={t('bill.itemLabel')} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('bill.itemLabelPlaceholder')} error={labelError} maxLength={40} autoComplete="off" />
      <CurrencyField label={kind === 'individual' ? t('bill.pricePerPerson') : t('bill.unitPrice')} value={price} onValueChange={setPrice} error={priceError} />

      {kind !== 'individual' ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-semibold">{kind === 'rental' ? t('bill.rentalQty') : t('bill.quantity')}</p>
          <Stepper value={qty} onChange={setQty} min={1} max={99} label={t('bill.quantity')} decreaseLabel={t('common.decrease')} increaseLabel={t('common.increase')} />
        </div>
      ) : null}

      {kind === 'shared' || kind === 'individual' ? (
        <section aria-labelledby="payers-h">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="payers-h" className="text-[15px] font-bold">
              {t('bill.payers')}
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setPayers(payers.size === allIds.length ? new Set() : new Set(allIds))}>
              {payers.size === allIds.length ? t('session.setup.deselectAll') : t('bill.allParticipants')}
            </Button>
          </div>
          <PlayerToggles people={billable} selected={payers} onToggle={toggle(payers, setPayers)} label={t('bill.payers')} />
          {payerError ? <p role="alert" className="mt-2 text-[13px] text-danger">{payerError}</p> : null}
        </section>
      ) : null}

      {kind === 'rental' ? (
        <section aria-labelledby="own-h">
          <h3 id="own-h" className="text-[15px] font-bold">
            {t('bill.broughtOwn')}
          </h3>
          <p className="mb-2 text-[13px] text-ink-muted">{t('bill.broughtOwnHint')}</p>
          <PlayerToggles people={billable} selected={own} onToggle={toggle(own, setOwn)} label={t('bill.broughtOwn')} />
          <p className="num mt-3 rounded-md border border-line bg-surface-2 p-3 text-[14px]" aria-live="polite">
            {caption ? t('bill.rentalCaption', { qty: caption.quantity, price: formatIdr(caption.unitPrice), payers: caption.payers, per: formatIdr(caption.perPerson) }) : t('bill.error.noPayers')}
          </p>
          {payerError ? <p role="alert" className="mt-2 text-[13px] text-danger">{payerError}</p> : null}
        </section>
      ) : null}

      <p className="num text-right text-[15px] text-ink-muted" aria-live="polite">
        {t('bill.total')}: <span className="font-bold text-ink">{formatIdr(total)}</span>
      </p>

      <div className="flex flex-col gap-2">
        <Button size="lg" fullWidth onClick={save}>
          {t('common.save')}
        </Button>
        {item && onDelete ? (
          <Button
            variant="ghost"
            fullWidth
            className="text-danger"
            onClick={() => {
              onDelete(item.id);
              onClose();
            }}
          >
            {t('common.delete')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function BillItemSheet(props: Props) {
  const { t } = useTranslation();
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.item ? t('bill.editItem') : t('bill.addItem')} closeLabel={t('common.close')}>
      {props.open ? <Form key={props.item?.id ?? 'new'} {...props} /> : null}
    </Sheet>
  );
}
