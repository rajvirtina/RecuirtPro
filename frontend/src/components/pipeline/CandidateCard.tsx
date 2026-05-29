import { formatDistanceToNow } from 'date-fns';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, useReducedMotion } from 'framer-motion';
import { Avatar } from '../ui/Avatar';
import { spring } from '../../lib/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineCandidate {
  _id: string;
  candidateId: string;
  candidate?: { firstName: string; lastName: string; email: string; profileImage?: string };
  job?: { _id: string; title: string };
  status: string;
  appliedAt: string;
  overallScore?: number;
  source?: string;
  hasInterview?: boolean;
}

interface CandidateCardProps {
  application: PipelineCandidate;
  isReadOnly?: boolean;
  onAdvance?: (id: string) => void;
  onReject?: (id: string) => void;
  onView?: (id: string) => void;
}

// ─── Score Color ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-success-100 text-success-700';
  if (score >= 60) return 'bg-primary-100 text-primary-700';
  if (score >= 40) return 'bg-warning-100 text-warning-700';
  return 'bg-error-100 text-error-700';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CandidateCard({
  application,
  isReadOnly = false,
  onAdvance,
  onReject,
  onView,
}: CandidateCardProps) {
  const reduced = useReducedMotion();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition: dndTransition,
    isDragging,
  } = useSortable({
    id: application._id,
    disabled: isReadOnly,
  });

  // dnd-kit positional transform applied to the outer positioning div
  const positionStyle = {
    transform: CSS.Transform.toString(transform),
    transition: dndTransition,
    // Ensure the dragging card is above everything
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' as const : undefined,
  };

  const name = application.candidate
    ? `${application.candidate.firstName} ${application.candidate.lastName}`
    : 'Unknown Candidate';

  const appliedAgo = formatDistanceToNow(new Date(application.appliedAt), { addSuffix: true });

  return (
    // Outer div: dnd-kit controls positioning
    <div ref={setNodeRef} style={positionStyle} {...attributes} {...listeners}>
      {/* Inner motion.div: framer-motion controls visual state (scale, shadow, rotate) */}
      <motion.div
        className="group bg-white rounded-lg border border-neutral-200 p-3 cursor-grab active:cursor-grabbing
          hover:border-primary-200 transition-colors duration-150"
        animate={
          isDragging && !reduced
            ? { scale: 1.04, rotate: 1.5, boxShadow: '0 20px 40px rgba(0,0,0,0.18)', opacity: 1 }
            : { scale: 1,    rotate: 0,   boxShadow: '0 1px 3px rgba(0,0,0,0.08)',  opacity: isDragging ? 0.4 : 1 }
        }
        transition={isDragging ? spring.stiff : spring.settle}
        whileHover={!isDragging && !reduced ? { boxShadow: '0 4px 12px rgba(0,0,0,0.10)' } : undefined}
        layout={!reduced}
        layoutId={application._id}
      >
        {/* Top: Avatar + Name */}
        <div className="flex items-start gap-2.5">
          <Avatar name={name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900 truncate">{name}</p>
            {application.job && (
              <p className="text-xs text-neutral-500 truncate">{application.job.title}</p>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[10px] text-neutral-400">{appliedAgo}</span>

          {application.overallScore != null && application.overallScore > 0 && (
            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${scoreColor(application.overallScore)}`}>
              {application.overallScore}% match
            </span>
          )}

          {application.source && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-600">
              {application.source}
            </span>
          )}

          {application.hasInterview && (
            <span className="inline-flex items-center text-primary-500" title="Interview scheduled">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          )}
        </div>

        {/* Quick actions on hover */}
        {!isReadOnly && (
          <div className="hidden group-hover:flex items-center gap-1 mt-2 pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdvance?.(application._id); }}
              className="flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-primary-600 bg-primary-50 rounded hover:bg-primary-100 transition-colors"
              title="Advance to next stage"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Advance
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReject?.(application._id); }}
              className="flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-error-600 bg-error-50 rounded hover:bg-error-100 transition-colors"
              title="Reject"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onView?.(application._id); }}
              className="ml-auto flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-neutral-600 bg-neutral-50 rounded hover:bg-neutral-100 transition-colors"
              title="View profile"
            >
              View
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
