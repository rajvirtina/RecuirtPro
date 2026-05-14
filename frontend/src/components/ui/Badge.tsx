import { clsx } from 'clsx';

type BadgeVariant = 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantMap: Record<BadgeVariant, string> = {
  blue:   'badge-blue',
  green:  'badge-green',
  yellow: 'badge-yellow',
  red:    'badge-red',
  gray:   'badge-gray',
  purple: 'badge-purple',
};

const dotColorMap: Record<BadgeVariant, string> = {
  blue:   'bg-info-500',
  green:  'bg-success-500',
  yellow: 'bg-warning-500',
  red:    'bg-error-500',
  gray:   'bg-neutral-400',
  purple: 'bg-primary-500',
};

export function Badge({ variant = 'gray', children, className, dot }: BadgeProps) {
  return (
    <span className={clsx('badge', variantMap[variant], className)}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColorMap[variant])} />}
      {children}
    </span>
  );
}

/* Normalise before lookup — handles mixed-case and space-separated API values */
export function statusVariant(status: string): BadgeVariant {
  const normalised = status.toLowerCase().trim().replace(/\s+/g, '_');

  const map: Record<string, BadgeVariant> = {
    applied:             'blue',
    shortlisted:         'yellow',
    interview_scheduled: 'purple',
    in_progress:         'purple',
    selected:            'green',
    hired:               'green',
    offer_released:      'green',
    rejected:            'red',
    on_hold:             'gray',
    withdrawn:           'gray',
    published:           'green',
    draft:               'yellow',
    closed:              'gray',
    expired:             'gray',
    on_hold_job:         'yellow',
    scheduled:           'purple',
    confirmed:           'green',
    completed:           'green',
    cancelled:           'red',
    no_show:             'red',
    rescheduled:         'yellow',
  };

  return map[normalised] ?? 'gray';
}

export function StatusBadge({ status }: { status: string }) {
  const label = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return (
    <Badge variant={statusVariant(status)} dot>
      {label}
    </Badge>
  );
}
