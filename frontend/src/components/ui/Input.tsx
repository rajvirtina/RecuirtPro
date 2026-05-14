import { forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string;
  hint?:    string;
  error?:   string;
  icon?:    React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, iconRight, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
            {label}
            {props.required && (
              <span className="text-error-500 ml-0.5" aria-hidden="true">*</span>
            )}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900',
              'placeholder:text-neutral-400 transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              'disabled:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400',
              icon      && 'pl-9',
              iconRight && 'pr-9',
              error
                ? 'border-error-400 focus:ring-error-400 focus:border-error-400'
                : 'border-neutral-200 hover:border-neutral-300',
              className,
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error ? `${inputId}-error` :
              hint  ? `${inputId}-hint`  : undefined
            }
            {...props}
          />
          {iconRight && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              aria-hidden="true"
            >
              {iconRight}
            </span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-error-600" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-neutral-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/* ── Select wrapper ────────────────────────────────────── */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?:  string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className, id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-neutral-700">
            {label}
            {props.required && <span className="text-error-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900',
            'transition-all duration-150 appearance-none',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:bg-neutral-50 disabled:cursor-not-allowed',
            error
              ? 'border-error-400 focus:ring-error-400'
              : 'border-neutral-200 hover:border-neutral-300',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="text-xs text-error-600" role="alert">{error}</p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className="text-xs text-neutral-400">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

/* ── Textarea wrapper ──────────────────────────────────── */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?:  string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const taId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={taId} className="text-sm font-medium text-neutral-700">
            {label}
            {props.required && <span className="text-error-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={taId}
          className={clsx(
            'w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900',
            'placeholder:text-neutral-400 transition-all duration-150 resize-y min-h-[80px]',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:bg-neutral-50 disabled:cursor-not-allowed',
            error
              ? 'border-error-400 focus:ring-error-400'
              : 'border-neutral-200 hover:border-neutral-300',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${taId}-error` : hint ? `${taId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${taId}-error`} className="text-xs text-error-600" role="alert">{error}</p>
        )}
        {hint && !error && (
          <p id={`${taId}-hint`} className="text-xs text-neutral-400">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
