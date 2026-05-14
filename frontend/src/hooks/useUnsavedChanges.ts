import { useEffect } from 'react';

/**
 * UX-004: Warn the user before navigating away when there are unsaved changes.
 * Pass `isDirty=true` to activate the browser's native "Leave page?" dialog.
 */
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers show their own generic message — custom text is ignored
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
