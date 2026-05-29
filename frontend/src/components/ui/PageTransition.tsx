import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { pageVariants } from '../../lib/motion';

/**
 * Wrap public/auth pages (outside the main Layout) in this component
 * to get the same fade+slide entry that protected routes have.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ minHeight: '100vh' }}
    >
      {children}
    </motion.div>
  );
}
