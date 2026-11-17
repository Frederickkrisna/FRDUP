import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { toast } from '@/components/toast/toastStore';
import { hostRepo } from '@/data/hostRosterRepo';
import { ImageTooLargeError, compressToDataUrl } from '@/features/shared/image';
import type { HostDoc } from '@/types/host';

/** Bank details + QRIS image. Saved on blur/press; included in the WhatsApp export and bill image. */
export function PaymentSection({ host }: { host: HostDoc }) {
  const { t } = useTranslation();
  const [bank, setBank] = useState(host.payment.bankName ?? '');
  const [account, setAccount] = useState(host.payment.accountNumber ?? '');
  const [holder, setHolder] = useState(host.payment.accountHolder ?? '');
  const [note, setNote] = useState(host.payment.note ?? '');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = (patch: Partial<HostDoc['payment']>) => {
    hostRepo.update(host.id, { payment: { ...host.payment, ...patch } });
  };

  const onQris = async (file: File) => {
    setBusy(true);
    try {
      save({ qrisImageUrl: await compressToDataUrl(file) });
    } catch (error) {
      toast.danger(error instanceof ImageTooLargeError ? t('settings.payment.qrisTooLarge') : t('settings.payment.qrisFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <TextField label={t('settings.payment.bank')} value={bank} onChange={(e) => setBank(e.target.value)} onBlur={() => save({ bankName: bank.trim() || null })} placeholder={t('settings.payment.bankPlaceholder')} autoComplete="off" maxLength={30} />
      <TextField label={t('settings.payment.accountNumber')} value={account} onChange={(e) => setAccount(e.target.value)} onBlur={() => save({ accountNumber: account.trim() || null })} inputMode="numeric" autoComplete="off" maxLength={30} />
      <TextField label={t('settings.payment.accountHolder')} value={holder} onChange={(e) => setHolder(e.target.value)} onBlur={() => save({ accountHolder: holder.trim() || null })} autoComplete="off" maxLength={40} />
      <TextField label={t('settings.payment.note')} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => save({ note: note.trim() || null })} autoComplete="off" maxLength={80} hint={t('settings.payment.noteHint')} />

      <div>
        <p className="mb-1.5 text-[13px] font-semibold tracking-[0.02em] text-ink-muted">{t('settings.payment.qris')}</p>
        {host.payment.qrisImageUrl ? (
          <div className="flex items-center gap-3">
            <img src={host.payment.qrisImageUrl} alt={t('settings.payment.qrisAlt')} className="size-24 rounded-md border border-line bg-white object-contain" />
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="secondary" loading={busy} onClick={() => fileRef.current?.click()}>
                {t('settings.payment.qrisReplace')}
              </Button>
              <Button size="sm" variant="ghost" leftIcon={<Trash2 size={16} aria-hidden="true" />} onClick={() => save({ qrisImageUrl: null })}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" fullWidth loading={busy} leftIcon={<ImagePlus size={18} aria-hidden="true" />} onClick={() => fileRef.current?.click()}>
            {t('settings.payment.qrisUpload')}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label={t('settings.payment.qrisUpload')}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onQris(file);
          }}
        />
      </div>
    </div>
  );
}
