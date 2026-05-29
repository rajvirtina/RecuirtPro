import { ReactNode, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { dur, ease } from '../../lib/motion';

interface AnimatedChartProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Wraps a Recharts chart and animates it in when scrolled into view.
 * Uses clip-path to create a draw-in effect (left-to-right reveal).
 * Falls back to simple fade on reduced-motion.
 */
export function AnimatedChart({ children, className = '', delay = 0 }: AnimatedChartProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? undefined : { opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      animate={
        inView
          ? reduced
            ? undefined
            : { opacity: 1, clipPath: 'inset(0 0% 0 0)' }
          : undefined
      }
      transition={{ duration: dur.slow, ease: ease.enter, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A simpler wrapper that fades + scales chart on view.
 * Use this for donut/radar charts where clip-path doesn't look right.
 */
export function AnimatedChartFade({ children, className = '', delay = 0 }: AnimatedChartProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? undefined : { opacity: 0, scale: 0.96 }}
      animate={
        inView
          ? reduced
            ? undefined
            : { opacity: 1, scale: 1 }
          : undefined
      }
      transition={{ duration: dur.base, ease: ease.enter, delay }}
    >
      {children}
    </motion.div>
  );
}
