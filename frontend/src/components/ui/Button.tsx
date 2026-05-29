import { forwardRef, ButtonHTMLAttributes } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import { spring } from '../../lib/motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   Variant;
  size?:      Size;
  loading?:   boolean;
  success?:   boolean;
  icon?:      React.ReactNode;
  iconRight?: React.ReactNode;
}

const sizeMap: Record<Size, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

const variantMap: Record<Variant, string> = {
  primary:     'btn-primary',
  secondary:   'btn-secondary',
  ghost:       'btn-ghost',
  destructive: 'btn-destructive',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, success, icon, iconRight, children, className, disabled, ...props }, ref) => {
    const reduced = useReducedMotion();

    return (
      <motion.button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-disabled={disabled || loading || undefined}
        className={clsx('btn', sizeMap[size], variantMap[variant], className)}
        // Hover: subtle scale + brightness lift
        whileHover={!disabled && !loading && !reduced
          ? { scale: 1.02, filter: 'brightness(1.05)' }
          : undefined
        }
        // Tap: press-down effect
        whileTap={!disabled && !loading && !reduced
          ? { scale: 0.97 }
          : undefined
        }
        transition={spring.stiff}
        {...(props as any)}
      >
        {loading ? (
          <>
            <motion.svg
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              animate={reduced ? undefined : { rotate: 360 }}
              transition={reduced ? undefined : { duration: 0.8, repeat: Infinity, ease: 'linear' }}
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </motion.svg>
            <span className="sr-only">Loading…</span>
          </>
        ) : success ? (
          <motion.svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            initial={reduced ? undefined : { scale: 0, opacity: 0 }}
            animate={reduced ? undefined : { scale: 1, opacity: 1 }}
            transition={spring.bouncy}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </motion.svg>
        ) : icon ? (
          <span className="shrink-0" aria-hidden="true">{icon}</span>
        ) : null}
        {children}
        {!loading && !success && iconRight && (
          <span className="shrink-0" aria-hidden="true">{iconRight}</span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
