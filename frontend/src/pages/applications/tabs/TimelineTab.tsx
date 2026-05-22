import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import apiClient from '../../../services/api';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';

interface ActivityEvent {
  _id: string;
  actorId: string;
  actorName: string;
  type: string;
  metadata: Record<string, any>;
  createdAt: string;
}

interface TimelineResponse {
  data: ActivityEvent[];
  pagination: { total: number; page: number; pages?: number; totalPages?: number };
}

const EVENT_CONFIG: Record<string, { icon: string; template: (e: ActivityEvent) => string }> = {
  application_submitted: {
    icon: '📥',
    template: (e) => `${e.actorName} submitted their application`,
  },
  stage_changed: {
    icon: '↗️',
    template: (e) => `Stage changed from ${e.metadata.from} to ${e.metadata.to} by ${e.actorName}`,
  },
  note_added: {
    icon: '📝',
    template: (e) => `${e.actorName} added a note`,
  },
  interview_scheduled: {
    icon: '📅',
    template: (e) => `Interview scheduled for ${e.metadata.scheduledAt ? new Date(e.metadata.scheduledAt).toLocaleDateString() : 'TBD'} via ${e.metadata.platform || 'online'}`,
  },
  interview_completed: {
    icon: '✅',
    template: (e) => `Interview completed by ${e.actorName}`,
  },
  status_changed: {
    icon: '🔄',
    template: (e) => `Status changed from ${e.metadata.from} to ${e.metadata.to} by ${e.actorName}`,
  },
  resume_parsed: {
    icon: '📄',
    template: () => `Resume parsed successfully`,
  },
  ai_score_updated: {
    icon: '🤖',
    template: (e) => `AI assessment completed — Overall score: ${e.metadata.score || '?'}%`,
  },
  email_sent: {
    icon: '✉️',
    template: (e) => `Email sent to candidate by ${e.actorName}`,
  },
  viewed: {
    icon: '👁️',
    template: (e) => `${e.actorName} viewed this application`,
  },
};

export function TimelineTab({ applicationId }: { applicationId: string }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTimelineQuery(applicationId);

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4 py-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse flex gap-3">
            <div className="w-8 h-8 bg-neutral-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-neutral-200 rounded w-2/3" />
              <div className="h-2 bg-neutral-100 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const events = data?.data ?? [];

  if (events.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-12 text-center">
        <span className="text-3xl mb-2">📋</span>
        <p className="text-sm font-medium text-neutral-500">No activity yet</p>
        <p className="text-xs text-neutral-400 mt-1">Events will appear here as actions are taken.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <ol className="relative border-l border-neutral-200 ml-4 space-y-6 py-2">
        {events.map((event) => {
          const config = EVENT_CONFIG[event.type] || { icon: '•', template: () => event.type };
          return (
            <li key={event._id} className="ml-6">
              <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-white rounded-full border border-neutral-200 text-sm">
                {config.icon}
              </span>
              <div className="flex items-start gap-2">
                <Avatar name={event.actorName} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm text-neutral-800">{config.template(event)}</p>
                  <time className="text-xs text-neutral-400">
                    {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                  </time>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load 20 more'}
          </Button>
        </div>
      )}
    </div>
  );
}

// Simple paginated query hook
function useTimelineQuery(applicationId: string) {
  const { data, isLoading, refetch } = useQuery<TimelineResponse>({
    queryKey: ['timeline', applicationId],
    queryFn: () => apiClient.get(`/applications/${applicationId}/timeline`).then(r => r.data),
  });

  // API may return either `pages` or `totalPages` — handle both safely
  const currentPage  = data?.pagination?.page ?? 1;
  const totalPages   = data?.pagination?.totalPages ?? data?.pagination?.pages ?? 1;
  const hasNextPage  = currentPage < totalPages;

  return {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage: () => {
      refetch();
    },
  };
}
