import { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?:    ReactNode;
  title:    string;
  desc?:    string;
  action?:  { label: string; onClick: () => void };
  children?: ReactNode;
}

export function EmptyState({ icon, title, desc, action, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="mb-4 p-3 rounded-xl bg-neutral-100">
          <span className="empty-icon block">{icon}</span>
        </div>
      )}
      <h3 className="empty-title">{title}</h3>
      {desc && <p className="empty-desc">{desc}</p>}
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

/* Pre-built empty states for common views */
export function EmptyJobs({ canCreate, onCreate }: { canCreate?: boolean; onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<BriefcaseIcon />}
      title="No jobs yet"
      desc={canCreate ? 'Post your first job to start attracting candidates.' : 'Check back later for new opportunities.'}
      action={canCreate && onCreate ? { label: '+ Post New Job', onClick: onCreate } : undefined}
    />
  );
}

export function EmptyApplications({ isCandidate }: { isCandidate?: boolean }) {
  return (
    <EmptyState
      icon={<DocumentIcon />}
      title="No applications found"
      desc={isCandidate ? 'Start applying to jobs to track your progress here.' : 'No applications match the current filter.'}
    />
  );
}

export function EmptyInterviews() {
  return (
    <EmptyState
      icon={<CalendarIcon />}
      title="No interviews scheduled"
      desc="Interviews will appear here once scheduled."
    />
  );
}

/* Inline SVG icons */
function BriefcaseIcon() {
  return (
    <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
