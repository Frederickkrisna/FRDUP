import { useState } from 'react';
import { Copy, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { toast } from '@/components/toast/toastStore';
import type { StandingRow } from '@/core/matchmaking/types';
import type { BillDoc } from '@/types/bill';
import type { HostDoc } from '@/types/host';
import type { SessionDoc } from '@/types/session';
import { billCardData, billFilename, copyText, openWhatsapp, whatsappText } from './billExport';

type Props = { session: SessionDoc; bill: BillDoc; host: HostDoc; standings: StandingRow[]; disabled?: boolean };

/** Copy text · WhatsApp · image card. The image modules load only when that button is pressed. */
export function BillExportButtons({ session, bill, host, standings, disabled = false }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const text = () => whatsappText({ session, bill, host, standings, t });

  const exportImage = async () => {
    setBusy(true);
    try {
      const [{ renderCard }, { shareCard }, { BillCard }] = await Promise.all([
        import('@/features/export/render'),
        import('@/features/export/share'),
        import('./BillCard'),
      ]);
      const { data, format } = billCardData({ session, bill, host, t });
      const card = await renderCard(<BillCard data={data} format={format} />, format);
      try {
        const outcome = await shareCard(card, billFilename(session), t('bill.shareText'));
        if (outcome === 'downloaded') toast.success(t('bill.imageSaved'));
      } finally {
        URL.revokeObjectURL(card.url);
      }
    } catch {
      toast.danger(t('bill.imageFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="lg"
          disabled={disabled}
          leftIcon={<Copy size={18} aria-hidden="true" />}
          onClick={() => void copyText(text()).then((ok) => (ok ? toast.success(t('common.copied')) : toast.danger(t('bill.copyFailed'))))}
        >
          {t('bill.copyText')}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={disabled}
          leftIcon={<MessageCircle size={18} aria-hidden="true" />}
          onClick={() => void openWhatsapp(text()).then((r) => r === 'failed' && toast.danger(t('bill.whatsappFailed')))}
        >
          {t('bill.whatsapp')}
        </Button>
      </div>
      <Button size="lg" fullWidth loading={busy} disabled={disabled} leftIcon={<ImageIcon size={18} aria-hidden="true" />} onClick={() => void exportImage()}>
        {t('bill.exportImage')}
      </Button>
    </div>
  );
}
