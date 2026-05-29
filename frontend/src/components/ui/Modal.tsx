import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { backdropVariants, modalVariants, drawerVariants } from '../../lib/motion';

// ── Base Modal ────────────────────────────────────────────────────────────────

interface ModalProps {
  open:       boolean;
  onClose:    () => void;
  children:   ReactNode;
  title?:     string;
  size?:      'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ open, onClose, children, title, size = 'md', className = '' }: ModalProps) {
  const reduced = useReducedMotion();

  // Lock body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else      document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm"
            variants={reduced ? undefined : backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            className={`relative w-full ${sizeClass[size]} bg-white rounded-xl shadow-xl overflow-hidden ${className}`}
            variants={reduced ? undefined : modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                <h2 className="text-h3 text-neutral-900">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ── Drawer (slide from right) ────────────────────────────────────────────────

interface DrawerProps {
  open:     boolean;
  onClose:  () => void;
  children: ReactNode;
  title?:   string;
  width?:   string;
}

export function Drawer({ open, onClose, children, title, width = 'max-w-md' }: DrawerProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else      document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            variants={reduced ? undefined : backdropVariants}
            initial="hidden" animate="visible" exit="exit"
            onClick={onClose}
          />
          <motion.div
            className={`relative h-full ${width} w-full bg-white shadow-xl flex flex-col`}
            variants={reduced ? undefined : drawerVariants}
            initial="hidden" animate="visible" exit="exit"
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
                <h2 className="text-h3 text-neutral-900">{title}</h2>
                <button type="button" onClick={onClose} aria-label="Close"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
