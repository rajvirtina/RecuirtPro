import { ReactNode, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { staggerContainer, staggerItem } from '../../lib/motion';

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  /** Duration in ms for auto-animate transitions */
  duration?: number;
}

/**
 * Wrapper that auto-animates add/remove/reorder of children.
 * Uses @formkit/auto-animate — just wrap your list items.
 */
export function AnimatedList({ children, className = '', duration = 200 }: AnimatedListProps) {
  const reduced = useReducedMotion();
  const [ref] = useAutoAnimate<HTMLDivElement>({
    duration: reduced ? 0 : duration,
    easing: 'ease-out',
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
}

/**
 * Framer Motion stagger container — items animate in sequence on mount.
 * Wrap each child in StaggerItem for the effect.
 */
export function StaggerList({ children, className = '', stagger = 0.06 }: StaggerListProps) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer(stagger)}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
