import { motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';

const OFFER_STAGES = [
  { id: 'draft',            label: 'Draft' },
  { id: 'pending_approval', label: 'Pending' },
  { id: 'approved',         label: 'Approved' },
  { id: 'sent',             label: 'Sent' },
  { id: 'accepted',         label: 'Accepted' },
];

interface OfferStepperProps {
  currentStatus: string;
  className?: string;
}

/**
 * Animated horizontal stepper showing offer lifecycle progress.
 * Fills connectors and highlights steps as status advances.
 */
export function OfferStepper({ currentStatus, className = '' }: OfferStepperProps) {
  const reduced = useReducedMotion();
  const currentIndex = OFFER_STAGES.findIndex(s => s.id === currentStatus);
  // If status is not in the linear flow (e.g. rejected/withdrawn), show up to last known
  const activeIndex = currentIndex >= 0 ? currentIndex : OFFER_STAGES.length - 1;

  return (
    <div className={clsx('flex items-center w-full', className)}>
      {OFFER_STAGES.map((stage, i) => {
        const isCompleted = i < activeIndex;
        const isActive = i === activeIndex;
        const isFuture = i > activeIndex;

        return (
          <div key={stage.id} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <motion.div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2',
                  isCompleted && 'bg-success-500 border-success-500 text-white',
                  isActive && 'bg-primary-600 border-primary-600 text-white',
                  isFuture && 'bg-white border-neutral-200 text-neutral-400',
                )}
                initial={false}
                animate={reduced ? undefined : { scale: isActive ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {isCompleted ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </motion.div>
              <span className={clsx(
                'text-[10px] mt-1 font-medium whitespace-nowrap',
                isActive ? 'text-primary-700' : isCompleted ? 'text-neutral-600' : 'text-neutral-400',
              )}>
                {stage.label}
              </span>
            </div>

            {/* Connector */}
            {i < OFFER_STAGES.length - 1 && (
              <div className="flex-1 h-0.5 mx-1.5 bg-neutral-200 relative overflow-hidden rounded-full">
                <motion.div
                  className="absolute inset-0 bg-success-400 origin-left"
                  initial={false}
                  animate={{ scaleX: isCompleted ? 1 : 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
