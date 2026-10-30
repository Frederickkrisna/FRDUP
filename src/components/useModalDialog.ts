import { useEffect, useRef, useState } from 'react';

const EXIT_MS = 220;
let openCount = 0;

/**
 * Shared behaviour for <dialog>-based overlays (Sheet, ConfirmDialog):
 * native focus trap + Esc, enter/exit animation flag, page scroll lock while open.
 */
export function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const [entered, setEntered] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Open: show modally, lock page scroll, flip the animation flag on the next frame.
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg || !open) return;
    if (!dlg.open) dlg.showModal();
    openCount += 1;
    document.documentElement.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(raf);
      setEntered(false);
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.documentElement.style.overflow = '';
    };
  }, [open]);

  // Close: let the exit animation play, then really close the dialog.
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg || open || !dlg.open) return;
    const timer = setTimeout(() => dlg.close(), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    // Esc: let the parent decide (it flips `open`), so state and DOM never disagree.
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dlg.addEventListener('cancel', onCancel);
    return () => dlg.removeEventListener('cancel', onCancel);
  }, []);

  return { ref, visible: open && entered };
}
