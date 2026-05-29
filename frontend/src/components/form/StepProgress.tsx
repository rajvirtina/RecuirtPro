import { clsx } from 'clsx';
import { motion } from 'framer-motion';

export interface WizardStep {
  id:    number;
  label: string;
  desc?: string;
}

interface StepProgressProps {
  steps:          WizardStep[];
  currentStep:    number;
  completedSteps: Set<number>;
  onStepClick:    (stepId: number) => void;
  /** Optional right-side slot — used for the auto-save status label */
  rightSlot?:     React.ReactNode;
}

export function StepProgress({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  rightSlot,
}: StepProgressProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <nav
        className="flex items-center gap-0 flex-1 min-w-0"
        aria-label="Form progress"
      >
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isActive    = step.id === currentStep;
          const isFuture    = !isCompleted && !isActive;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              {/* Step node */}
              <div className="flex flex-col items-center shrink-0">
                <button
                  type="button"
                  onClick={() => isCompleted && onStepClick(step.id)}
                  disabled={!isCompleted}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`${step.label}${isCompleted ? ' (completed, click to revisit)' : isActive ? ' (current)' : ' (upcoming)'}`}
                  className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                    'transition-all duration-200',
                    isCompleted
                      ? 'bg-success-500 text-white hover:bg-success-600 cursor-pointer ring-0 hover:ring-2 hover:ring-success-200'
                      : isActive
                      ? 'bg-primary-600 text-white ring-4 ring-primary-100 cursor-default'
                      : 'bg-neutral-100 text-neutral-400 cursor-not-allowed',
                  )}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </button>

                {/* Label below circle */}
                <div className="mt-1.5 text-center hidden sm:block">
                  <p className={clsx(
                    'text-xs font-semibold leading-tight',
                    isActive    ? 'text-primary-700'  :
                    isCompleted ? 'text-neutral-700'  :
                                  'text-neutral-400',
                  )}>
                    {step.label}
                  </p>
                  {step.desc && (
                    <p className="text-[10px] text-neutral-400 leading-tight whitespace-nowrap">
                      {step.desc}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line with animated fill */}
              {index < steps.length - 1 && (
                <div
                  className="flex-1 h-px mx-2 mt-[-14px] sm:mt-[-28px] bg-neutral-200 relative overflow-hidden"
                  aria-hidden="true"
                >
                  <motion.div
                    className="absolute inset-0 bg-success-400 origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isCompleted ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {rightSlot && (
        <div className="shrink-0 pl-4 hidden sm:block">
          {rightSlot}
        </div>
      )}
    </div>
  );
}
