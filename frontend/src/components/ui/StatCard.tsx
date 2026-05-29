import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import { spring } from '../../lib/motion';
import { AnimatedNumber } from './AnimatedNumber';

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
  index?:     number;  // for stagger delay
}

export function StatCard({ label, value, icon, iconBg = 'bg-primary-50', trend, sub, onClick, className, index = 0 }: StatCardProps) {
  const reduced    = useReducedMotion();
  const numericVal = typeof value === 'number' ? value : undefined;

  return (
    <motion.div
      className={clsx(
        'stat-card',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
      // Entry stagger
      initial={reduced ? undefined : { opacity: 0, y: 10 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      transition={reduced ? undefined : { duration: 0.25, ease: [0.0, 0, 0.2, 1], delay: index * 0.06 }}
      // Hover lift — only transform + shadow (no layout thrash)
      whileHover={reduced ? undefined : { y: -2, boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)' }}
      whileTap={onClick && !reduced ? { scale: 0.99 } : undefined}
      style={{ willChange: 'transform' }}
    >
      <div className={clsx('stat-icon shrink-0', iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="stat-label truncate">{label}</p>
        <p className="stat-value">
          {numericVal !== undefined
            ? <AnimatedNumber value={numericVal} />
            : value
          }
        </p>
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
    </motion.div>
  );
}
