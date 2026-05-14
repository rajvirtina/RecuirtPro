import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface StatCardProps {
  label:      string;
  value:      string | number;
  icon:       ReactNode;
  iconBg?:    string;
  trend?:     { value: string; up?: boolean; neutral?: boolean };
  sub?:       string;
  href?:      string;
  onClick?:   () => void;
  className?: string;
}

export function StatCard({ label, value, icon, iconBg = 'bg-primary-50', trend, sub, onClick, className }: StatCardProps) {
  return (
    <div
      className={clsx(
        'stat-card',
        onClick && 'cursor-pointer hover:border-primary-200 hover:shadow-sm transition-all duration-150',
        className,
      )}
      onClick={onClick}
    >
      <div className={clsx('stat-icon shrink-0', iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="stat-label truncate">{label}</p>
        <p className="stat-value">{value}</p>
        {trend && (
          <span className={clsx('stat-trend', trend.neutral ? 'flat' : trend.up ? 'up' : 'down')}>
            {!trend.neutral && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={trend.up ? 'M7 17l5-5 5 5' : 'M7 7l5 5 5-5'} />
              </svg>
            )}
            {trend.value}
          </span>
        )}
        {sub && !trend && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
