import { ReactNode, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface TooltipProps {
  content: string;
  children: ReactNode;
  delay?: number;
  side?: 'top' | 'bottom';
}

/**
 * Animated tooltip — fades + rises on hover with a short delay.
 * Respects reduced-motion.
 */
export function Tooltip({ content, children, delay = 300, side = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);
  const reduced = useReducedMotion();
  let timeout: ReturnType<typeof setTimeout>;

  const handleEnter = () => {
    timeout = setTimeout(() => setShow(true), delay);
  };
  const handleLeave = () => {
    clearTimeout(timeout);
    setShow(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            role="tooltip"
            className={`absolute z-50 px-2.5 py-1.5 text-xs font-medium text-white bg-neutral-800 rounded-md shadow-lg whitespace-nowrap pointer-events-none
              ${side === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : 'top-full mt-2 left-1/2 -translate-x-1/2'}`}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
