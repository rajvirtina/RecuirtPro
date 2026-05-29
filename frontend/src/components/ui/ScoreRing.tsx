import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { dur, ease } from '../../lib/motion';

interface ScoreRingProps {
  score: number;       // 0-100
  size?: number;       // diameter in px
  strokeWidth?: number;
  color?: string;
  label?: string;
  className?: string;
}

/**
 * Animated circular score ring that draws from 0 → score on view.
 * Only animates transform/opacity for 60fps.
 */
export function ScoreRing({
  score,
  size = 80,
  strokeWidth = 6,
  color = '#6366f1',
  label,
  className = '',
}: ScoreRingProps) {
  const reduced = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.min(100, Math.max(0, score));

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-neutral-100"
        />
        {/* Animated score arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={
            inView
              ? { strokeDashoffset: circumference - (normalizedScore / 100) * circumference }
              : { strokeDashoffset: circumference }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { duration: dur.slow + 0.2, ease: ease.enter, delay: 0.1 }
          }
        />
      </svg>
      {/* Center value */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-neutral-900">{score}</span>
      </div>
      {label && <span className="text-xs text-neutral-500 mt-1.5">{label}</span>}
    </div>
  );
}
