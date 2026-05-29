import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value:      number;
  duration?:  number;  // ms
  prefix?:    string;
  suffix?:    string;
  className?: string;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);  // cubic ease-out
}

/**
 * Counts from 0 → value on mount (or whenever value changes).
 * Respects prefers-reduced-motion by showing the final value immediately.
 */
export function AnimatedNumber({ value, duration = 800, prefix = '', suffix = '', className }: AnimatedNumberProps) {
  const reduced        = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const rafRef         = useRef<number>(0);
  const startTimeRef   = useRef<number>(0);
  const startValueRef  = useRef<number>(0);

  useEffect(() => {
    if (reduced) { setDisplay(value); return; }

    cancelAnimationFrame(rafRef.current);
    startValueRef.current = display;
    startTimeRef.current  = performance.now();

    const animate = (now: number) => {
      const elapsed  = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedVal = startValueRef.current + (value - startValueRef.current) * easeOut(progress);
      setDisplay(Math.round(easedVal));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={className} aria-label={`${prefix}${value}${suffix}`}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
}
