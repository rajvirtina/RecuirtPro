import React, { useRef, useState } from 'react';
import { clsx } from 'clsx';

interface TagInputProps {
  label?:       React.ReactNode;
  hint?:        string;
  error?:       string;
  tags:         string[];
  onChange:     (tags: string[]) => void;
  placeholder?: string;
  maxTags?:     number;
  className?:   string;
}

export function TagInput({
  label,
  hint,
  error,
  tags,
  onChange,
  placeholder = 'Type and press Enter…',
  maxTags = 40,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || tags.includes(tag) || tags.length >= maxTags) {
      setInputValue('');
      return;
    }
    onChange([...tags, tag]);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Tag container acts as the full input area */}
      <div
        className={clsx(
          'min-h-[44px] flex flex-wrap gap-1.5 p-2 rounded-lg border bg-white cursor-text',
          'transition-all duration-150',
          error
            ? 'border-error-400 focus-within:ring-2 focus-within:ring-error-400'
            : 'border-neutral-200 hover:border-neutral-300 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary-50 border border-primary-100 text-primary-700 rounded-md text-xs font-medium select-none"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(i); }}
              className="hover:text-primary-900 transition-colors leading-none"
              aria-label={`Remove ${tag}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputValue.trim() && addTag(inputValue)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-neutral-900 placeholder:text-neutral-400 py-0.5"
          aria-label={label ?? 'Tag input'}
        />
      </div>

      <div className="flex items-center justify-between mt-1">
        <div>
          {error && <p className="text-xs text-error-600">{error}</p>}
          {!error && hint && <p className="text-xs text-neutral-400">{hint}</p>}
        </div>
        {tags.length > 0 && (
          <p className="text-xs text-neutral-400">
            {tags.length}{maxTags < 40 ? `/${maxTags}` : ''} {tags.length === 1 ? 'tag' : 'tags'}
          </p>
        )}
      </div>
    </div>
  );
}
