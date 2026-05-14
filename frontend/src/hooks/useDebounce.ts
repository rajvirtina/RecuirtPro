import { useState, useEffect } from 'react';

/**
 * UX-005: Debounce a rapidly-changing value to avoid firing on every keystroke.
 * Use for search inputs: const debouncedSearch = useDebounce(search, 300);
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
