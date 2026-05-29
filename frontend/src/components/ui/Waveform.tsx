import { motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';

interface WaveformProps {
  active?: boolean;
  bars?: number;
  className?: string;
  color?: string;
}

/**
 * Animated waveform bars — used for voice recording indicator.
 * Only animates transform (scaleY) for 60fps.
 * Falls back to a static icon on reduced-motion.
 */
export function Waveform({ active = false, bars = 5, className = '', color = 'bg-primary-500' }: WaveformProps) {
  const reduced = useReducedMotion();

  return (
    <div className={clsx('flex items-center gap-0.5 h-6', className)} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className={clsx('w-1 rounded-full origin-center', color)}
          style={{ height: '100%' }}
          animate={
            active && !reduced
              ? {
                  scaleY: [0.3, 1, 0.5, 0.8, 0.3],
                }
              : { scaleY: 0.3 }
          }
          transition={
            active && !reduced
              ? {
                  duration: 0.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.1,
                }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
}

interface RecordingIndicatorProps {
  recording?: boolean;
  className?: string;
}

/**
 * Pulsing red "REC" indicator for video/audio recording.
 */
export function RecordingIndicator({ recording = false, className = '' }: RecordingIndicatorProps) {
  const reduced = useReducedMotion();

  if (!recording) return null;

  return (
    <div className={clsx('flex items-center gap-1.5', className)}>
      <motion.div
        className="w-2.5 h-2.5 rounded-full bg-red-500"
        animate={reduced ? undefined : { scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
        transition={reduced ? undefined : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">REC</span>
    </div>
  );
}

interface ProgressRingProps {
  current: number;
  total: number;
  size?: number;
  className?: string;
}

/**
 * Calm progress ring showing "question X of Y" for the AI Interview Room.
 */
export function ProgressRing({ current, total, size = 48, className = '' }: ProgressRingProps) {
  const reduced = useReducedMotion();
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? current / total : 0;

  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-neutral-100"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-primary-500"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={reduced ? { duration: 0 } : { duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-neutral-700">
        {current}/{total}
      </span>
    </div>
  );
}
