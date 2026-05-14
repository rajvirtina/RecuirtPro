import { useEffect, useRef } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open:           boolean;
  title:          string;
  message?:       string;
  confirmLabel?:  string;
  cancelLabel?:   string;
  variant?:       'destructive' | 'primary';
  loading?:       boolean;
  onConfirm:      () => void;
  onCancel:       () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'destructive',
  loading      = false,
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

  /* Close on backdrop click */
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onCancel();
  };

  return (
    <dialog
      ref={ref}
      onClick={handleClick}
      onClose={onCancel}
      className="rounded-xl shadow-lg p-0 w-full max-w-sm border border-neutral-200
                 backdrop:bg-neutral-900/50 backdrop:backdrop-blur-sm
                 open:animate-fade-in"
    >
      <div className="p-6">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
          variant === 'destructive' ? 'bg-error-50' : 'bg-primary-50'
        }`}>
          {variant === 'destructive' ? (
            <svg className="w-5 h-5 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        <h2 className="text-base font-semibold text-neutral-900 mb-1.5">{title}</h2>
        {message && (
          <p className="text-sm text-neutral-500 leading-relaxed">{message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2.5 px-6 pb-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant}
          size="sm"
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
