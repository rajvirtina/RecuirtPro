/**
 * TextResponse
 *
 * A controlled auto-resizing textarea with a character counter.
 * Height grows to fit content; never shrinks below min-h-32 (8 rem).
 *
 * Props:
 *  value      – controlled value
 *  onChange   – called with new string (always ≤ maxLength)
 *  maxLength  – default 1500
 *  disabled   – disables input
 *  placeholder
 */

import React, { useRef, useEffect } from 'react';

const DEFAULT_MAX = 1500;

interface Props {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
}

export default function TextResponse({
  value,
  onChange,
  maxLength = DEFAULT_MAX,
  disabled = false,
  placeholder = 'Type your answer here…',
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize on every value change
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(128, el.scrollHeight)}px`; // 128 px = min-h-32
  }, [value]);

  const remaining   = maxLength - value.length;
  const isNearLimit = remaining <= 200;
  const isAtLimit   = remaining <= 0;

  const counterColor = isAtLimit
    ? 'text-error-500 font-semibold'
    : isNearLimit
    ? 'text-warning-500'
    : 'text-neutral-400';

  return (
    <div className="relative w-full">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          // Hard cap at maxLength
          const next = e.target.value;
          if (next.length <= maxLength) onChange(next);
        }}
        disabled={disabled}
        placeholder={placeholder}
        rows={5}
        className={[
          'w-full min-h-32 border rounded-xl p-4 pb-8',
          'text-sm text-neutral-900 placeholder-neutral-400',
          'resize-none leading-relaxed',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          'transition-colors duration-150',
          disabled
            ? 'bg-neutral-50 border-neutral-200 opacity-60 cursor-not-allowed'
            : 'bg-white border-neutral-200 hover:border-neutral-300',
        ].join(' ')}
        style={{ height: 'auto', minHeight: '8rem' }}
      />

      {/* Character counter – bottom-right corner */}
      <div
        className={`absolute bottom-3 right-3 text-xs pointer-events-none ${counterColor}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {value.length.toLocaleString()} / {maxLength.toLocaleString()}
      </div>

      {/* Subtle progress bar at bottom edge */}
      <div
        className="absolute bottom-0 left-0 h-0.5 rounded-b-xl transition-all duration-300"
        style={{
          width: `${Math.min(100, (value.length / maxLength) * 100)}%`,
          backgroundColor: isAtLimit ? '#ef4444' : isNearLimit ? '#f59e0b' : '#6366f1', // error-500 / warning-500 / primary-500
        }}
      />
    </div>
  );
}
