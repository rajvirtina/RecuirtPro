import { useState } from 'react';
import { clsx } from 'clsx';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name?:  string;
  src?:   string;
  size?:  AvatarSize;
  className?: string;
}

const sizeMap: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const colors = [
  'bg-primary-600', 'bg-info-600', 'bg-success-600',
  'bg-warning-600', 'bg-error-600', 'bg-purple-600',
];

/* Full-name hash: much better distribution than single charCodeAt(0) */
function getColor(name = '') {
  const idx = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2) || '?').toUpperCase();
}

export function Avatar({ name = '', src, size = 'md', className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClass  = sizeMap[size];
  const colorClass = getColor(name);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        className={clsx('rounded-full object-cover shrink-0', sizeClass, className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name || 'User avatar'}
      className={clsx(
        'rounded-full flex items-center justify-center shrink-0 font-semibold text-white select-none',
        sizeClass,
        colorClass,
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
