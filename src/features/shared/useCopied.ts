import { useEffect, useRef, useState } from 'react';

import { toast } from '@/components/toast/toastStore';
import { copyText } from '@/features/billing/billExport';

/**
 * Copy with feedback on the button itself ("Tersalin" for a moment) instead of a toast.
 * A failed copy still toasts, because then the user has to do something else.
 */
export function useCopied(failedMessage: string): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = (text: string) => {
    void copyText(text).then((ok) => {
      if (!ok) {
        toast.danger(failedMessage);
        return;
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    });
  };
  return [copied, copy];
}
