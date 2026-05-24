import { useRef, useEffect } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation dialog built on the native <dialog> element.
 *
 * - showModal() / close() are driven by the `open` prop.
 * - Escape key fires the native "cancel" event which we intercept with
 *   onCancel (React's synthetic onCancel prop) + preventDefault() so the
 *   parent owns the close lifecycle via `open`.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  const handleNativeCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    onCancel();
  };

  return (
    <dialog ref={ref} onCancel={handleNativeCancel} className="rounded-2xl border-0 p-0">
      <div className="p-6" style={{ minWidth: '300px' }}>
        <h2 className="text-base font-semibold text-neutral-900 mb-2">{title}</h2>
        {message && (
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">{message}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading} type="button">
            {cancelLabel}
          </Button>
          <Button variant={variant} size="sm" loading={loading} onClick={onConfirm} type="button">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
