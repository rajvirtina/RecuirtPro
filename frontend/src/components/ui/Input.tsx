import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { dur, ease } from '../../lib/motion';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, id, required, disabled, className, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700 mb-1.5">
            {label}
            {required && (
              <span className="text-error-600 ml-0.5" aria-hidden="true"> *</span>
            )}
          </label>
        )}

        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 flex items-center">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-describedby={
              hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={clsx(
              'w-full rounded-md border text-sm text-neutral-900 placeholder-neutral-400',
              'transition-colors duration-150 focus:outline-none',
              icon ? 'pl-9 pr-3 py-2' : 'px-3 py-2',
              disabled
                ? 'bg-neutral-50 cursor-not-allowed opacity-60'
                : hasError
                  ? 'bg-white border-error-400 focus:border-error-400 focus:ring-2 focus:ring-error-500'
                  : 'bg-white border-neutral-200 hover:border-neutral-300 focus:border-primary-600 focus:ring-2 focus:ring-primary-600',
              className,
            )}
            {...props}
          />
        </div>

        <AnimatePresence initial={false}>
          {hasError && (
            <motion.p
              id={`${inputId}-error`}
              role="alert"
              className="text-xs text-error-600 mt-1"
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto', transition: { duration: dur.fast, ease: ease.enter } }}
              exit={  { opacity: 0, y: -4, height: 0,      transition: { duration: dur.fast, ease: ease.exit  } }}
            >
              {error}
            </motion.p>
          )}
          {!hasError && hint && (
            <motion.p
              id={`${inputId}-hint`}
              className="text-xs text-neutral-400 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: dur.fast } }}
              exit={  { opacity: 0, transition: { duration: dur.fast } }}
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

Input.displayName = 'Input';

/* ─────────────────────────────────────────────────────────────── Select ── */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, id, required, disabled, className, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-neutral-700 mb-1.5">
            {label}
            {required && (
              <span className="text-error-600 ml-0.5" aria-hidden="true"> *</span>
            )}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          required={required}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined
          }
          className={clsx(
            'w-full rounded-md border text-sm text-neutral-900 px-3 py-2',
            'transition-colors duration-150 focus:outline-none appearance-none bg-no-repeat',
            'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")]',
            'bg-[length:16px_16px] bg-[right_10px_center] pr-8',
            disabled
              ? 'bg-neutral-50 cursor-not-allowed opacity-60'
              : hasError
                ? 'bg-white border-error-400 focus:border-error-400 focus:ring-2 focus:ring-error-500'
                : 'bg-white border-neutral-200 hover:border-neutral-300 focus:border-primary-600 focus:ring-2 focus:ring-primary-600',
            className,
          )}
          {...props}
        >
          {children}
        </select>

        <AnimatePresence initial={false}>
          {hasError && (
            <motion.p
              id={`${selectId}-error`}
              role="alert"
              className="text-xs text-error-600 mt-1"
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto', transition: { duration: dur.fast, ease: ease.enter } }}
              exit={  { opacity: 0, y: -4, height: 0,      transition: { duration: dur.fast, ease: ease.exit  } }}
            >
              {error}
            </motion.p>
          )}
          {!hasError && hint && (
            <motion.p
              id={`${selectId}-hint`}
              className="text-xs text-neutral-400 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: dur.fast } }}
              exit={  { opacity: 0, transition: { duration: dur.fast } }}
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

Select.displayName = 'Select';

/* ──────────────────────────────────────────────────────────── Textarea ── */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, id, required, disabled, className, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-neutral-700 mb-1.5">
            {label}
            {required && (
              <span className="text-error-600 ml-0.5" aria-hidden="true"> *</span>
            )}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined
          }
          className={clsx(
            'w-full rounded-md border text-sm text-neutral-900 placeholder-neutral-400 px-3 py-2',
            'transition-colors duration-150 focus:outline-none resize-y min-h-[80px]',
            disabled
              ? 'bg-neutral-50 cursor-not-allowed opacity-60'
              : hasError
                ? 'bg-white border-error-400 focus:border-error-400 focus:ring-2 focus:ring-error-500'
                : 'bg-white border-neutral-200 hover:border-neutral-300 focus:border-primary-600 focus:ring-2 focus:ring-primary-600',
            className,
          )}
          {...props}
        />

        <AnimatePresence initial={false}>
          {hasError && (
            <motion.p
              id={`${textareaId}-error`}
              role="alert"
              className="text-xs text-error-600 mt-1"
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto', transition: { duration: dur.fast, ease: ease.enter } }}
              exit={  { opacity: 0, y: -4, height: 0,      transition: { duration: dur.fast, ease: ease.exit  } }}
            >
              {error}
            </motion.p>
          )}
          {!hasError && hint && (
            <motion.p
              id={`${textareaId}-hint`}
              className="text-xs text-neutral-400 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: dur.fast } }}
              exit={  { opacity: 0, transition: { duration: dur.fast } }}
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
