import { useId, type ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';
import { useModalDialog } from './useModalDialog';

type Props = {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Reserved for: finishing a session, deleting a player, resetting data (docs/design.md §1.4).
 * Everything else is instant action + undo toast. The safe choice is the first focusable control.
 */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, destructive = false, loading, onConfirm, onCancel }: Props) {
  const { ref, visible } = useModalDialog(open, onCancel);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 hidden h-full max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-transparent open:grid open:place-items-center"
    >
      <div aria-hidden="true" className={cn('absolute inset-0 bg-[var(--c-overlay)] transition-opacity duration-200', visible ? 'opacity-100' : 'opacity-0')} />
      <div
        className={cn(
          'relative mx-5 w-full max-w-[360px] rounded-xl border border-line bg-surface p-5',
          'transition-[transform,opacity] duration-200 ease-[var(--ease-out)] motion-reduce:transition-opacity',
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0 motion-reduce:scale-100',
        )}
      >
        <h2 id={titleId} className="text-[20px] font-bold">
          {title}
        </h2>
        {body ? <div className="mt-2 text-[15px] text-ink-muted">{body}</div> : null}
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="secondary" fullWidth onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} fullWidth loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
