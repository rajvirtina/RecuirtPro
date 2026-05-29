import { useRef } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

/**
 * Returns ref + animation props for scroll-triggered fade+slide reveal.
 * Attach ref to the element, spread motionProps onto a motion.div.
 */
export function useScrollReveal(options?: { margin?: string; once?: boolean }) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, {
    once: options?.once ?? true,
    margin: options?.margin ?? '-60px',
  });

  const motionProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
        transition: { duration: 0.25, ease: [0, 0, 0.2, 1] },
      };

  return { ref, motionProps, inView };
}
