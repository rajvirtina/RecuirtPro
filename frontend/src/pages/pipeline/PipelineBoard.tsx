import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { Button } from '../../components/ui/Button';
import { SkeletonRow } from '../../components/ui/Skeleton';
import KanbanColumn from '../../components/pipeline/KanbanColumn';
import CandidateCard, { type PipelineCandidate } from '../../components/pipeline/CandidateCard';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

// These stage IDs must match the actual `status` values stored on Application documents
const DEFAULT_STAGES = [
  { id: 'applied',             label: 'Applied'              },
  { id: 'shortlisted',         label: 'Shortlisted'          },
  { id: 'interview_scheduled', label: 'Interview Scheduled'  },
  { id: 'in_progress',         label: 'In Progress'          },
  { id: 'selected',            label: 'Selected'             },
  { id: 'offer_released',      label: 'Offer Released'       },
  { id: 'hired',               label: 'Hired'                },
  { id: 'on_hold',             label: 'On Hold'              },
  { id: 'rejected',            label: 'Rejected'             },
];

type ViewMode = 'kanban' | 'list';

interface Job {
  _id: string;
  title: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PipelineBoard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isReadOnly = user?.role === 'interviewer';

  // State
  const [pipeline, setPipeline] = useState<Record<string, PipelineCandidate[]>>({});
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // Sensors for drag
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  // Fetch jobs (for the job filter dropdown)
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await apiClient.get('/jobs');
        const d = res.data as any;
        // API may return { data: { jobs: [...] } } or { jobs: [...] } or plain array
        const list: Job[] = Array.isArray(d) ? d
          : Array.isArray(d?.data) ? d.data
          : Array.isArray(d?.jobs) ? d.jobs
          : Array.isArray(d?.data?.jobs) ? d.data.jobs
          : [];
        setJobs(list);
      } catch {
        // non-critical — pipeline still works, just no job filter
      }
    };
    fetchJobs();
  }, []);

  // Fetch pipeline data
  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true);
      // Use applications endpoint and group client-side (no dedicated /pipeline endpoint)
      const params = selectedJob ? `?jobId=${selectedJob}&limit=200` : '?limit=200';
      const res = await apiClient.get(`/applications${params}`);
      const d = res.data as any;

      // Unwrap paginated or direct response shapes
      const apps: any[] = Array.isArray(d) ? d
        : Array.isArray(d?.data) ? d.data
        : Array.isArray(d?.applications) ? d.applications
        : Array.isArray(d?.data?.applications) ? d.data.applications
        : [];

      // Group by status into pipeline columns
      const grouped: Record<string, PipelineCandidate[]> = {};
      for (const stage of DEFAULT_STAGES) {
        grouped[stage.id] = [];
      }
      for (const app of apps) {
        const status = app.status || 'applied';
        if (grouped[status]) {
          grouped[status].push(app as PipelineCandidate);
        }
      }
      setPipeline(grouped);
    } catch (err) {
      toast.error('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  }, [selectedJob]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  // ─── Drag handlers ──────────────────────────────────────────────────────────

  const findCandidate = (id: string): PipelineCandidate | undefined => {
    for (const stage of Object.values(pipeline)) {
      const found = stage.find((c) => c._id === id);
      if (found) return found;
    }
    return undefined;
  };

  const findCandidateStage = (id: string): string | undefined => {
    for (const [stageId, candidates] of Object.entries(pipeline)) {
      if (candidates.some((c) => c._id === id)) return stageId;
    }
    return undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverColumnId(null);
      return;
    }

    // Determine target column — could be dropping over a column or over another card
    let targetColumn = over.id as string;
    if (!DEFAULT_STAGES.some((s) => s.id === targetColumn)) {
      // Dropping over a card — find which column it belongs to
      targetColumn = findCandidateStage(targetColumn as string) || '';
    }
    setOverColumnId(targetColumn);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumnId(null);

    if (!over) return;

    const candidateId = active.id as string;
    const sourceStage = findCandidateStage(candidateId);

    // Determine target column
    let targetStage = over.id as string;
    if (!DEFAULT_STAGES.some((s) => s.id === targetStage)) {
      targetStage = findCandidateStage(over.id as string) || '';
    }

    if (!sourceStage || !targetStage || sourceStage === targetStage) return;

    // Optimistic update
    const candidate = findCandidate(candidateId);
    if (!candidate) return;

    const prevPipeline = { ...pipeline };
    setPipeline((prev) => {
      const updated = { ...prev };
      updated[sourceStage] = prev[sourceStage].filter((c) => c._id !== candidateId);
      updated[targetStage] = [...prev[targetStage], { ...candidate, status: targetStage }];
      return updated;
    });

    // API call
    try {
      await apiClient.patch(`/applications/${candidateId}/status`, { status: targetStage });
      toast.success(`Moved to ${DEFAULT_STAGES.find((s) => s.id === targetStage)?.label || targetStage}`);
    } catch (e: any) {
      // Rollback
      setPipeline(prevPipeline);
      toast.error(e?.response?.data?.message || 'Failed to update stage');
    }
  };

  // ─── Quick actions ──────────────────────────────────────────────────────────

  const handleAdvance = async (id: string) => {
    const currentStage = findCandidateStage(id);
    if (!currentStage) return;
    const currentIndex = DEFAULT_STAGES.findIndex((s) => s.id === currentStage);
    const nextStage = DEFAULT_STAGES[currentIndex + 1];
    if (!nextStage || nextStage.id === 'rejected') return;

    const candidate = findCandidate(id);
    if (!candidate) return;

    const prevPipeline = { ...pipeline };
    setPipeline((prev) => {
      const updated = { ...prev };
      updated[currentStage] = prev[currentStage].filter((c) => c._id !== id);
      updated[nextStage.id] = [...prev[nextStage.id], { ...candidate, status: nextStage.id }];
      return updated;
    });

    try {
      await apiClient.patch(`/applications/${id}/status`, { status: nextStage.id });
      toast.success(`Advanced to ${nextStage.label}`);
    } catch (e: any) {
      setPipeline(prevPipeline);
      toast.error(e?.response?.data?.message || 'Failed to advance');
    }
  };

  const handleReject = async (id: string) => {
    const currentStage = findCandidateStage(id);
    if (!currentStage || currentStage === 'rejected') return;

    const candidate = findCandidate(id);
    if (!candidate) return;

    const prevPipeline = { ...pipeline };
    setPipeline((prev) => {
      const updated = { ...prev };
      updated[currentStage] = prev[currentStage].filter((c) => c._id !== id);
      updated['rejected'] = [...prev['rejected'], { ...candidate, status: 'rejected' }];
      return updated;
    });

    try {
      await apiClient.patch(`/applications/${id}/status`, { status: 'rejected' });
      toast.success('Candidate rejected');
    } catch (e: any) {
      setPipeline(prevPipeline);
      toast.error(e?.response?.data?.message || 'Failed to reject');
    }
  };

  const handleView = (id: string) => {
    navigate(`/applications/${id}`);
  };

  // ─── Drag overlay candidate ─────────────────────────────────────────────────

  const activeCandidate = activeId ? findCandidate(activeId) : null;

  // ─── List view redirect ─────────────────────────────────────────────────────

  if (viewMode === 'list') {
    navigate('/applications');
    return null;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Top bar */}
      <div className="shrink-0 p-6 pb-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="page-title">Pipeline</h1>
            <p className="page-subtitle">Visualize and manage candidates across hiring stages</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Job filter */}
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="field-input text-sm py-1.5 w-48"
            >
              <option value="">All Jobs</option>
              {jobs.map((job) => (
                <option key={job._id} value={job._id}>{job.title}</option>
              ))}
            </select>

            {/* View toggle */}
            <div className="flex border border-neutral-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex-1 px-6 pb-6">
          <div className="flex gap-4 overflow-x-auto">
            {DEFAULT_STAGES.map((s) => (
              <div key={s.id} className="min-w-[280px] w-[280px] shrink-0 bg-neutral-50 rounded-xl border border-neutral-200 p-3">
                <div className="h-6 bg-neutral-200 rounded w-24 mb-3 animate-pulse" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-neutral-100 rounded-lg mb-2 animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto px-6 pb-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full">
              {DEFAULT_STAGES.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stageId={stage.id}
                  stageLabel={stage.label}
                  candidates={pipeline[stage.id] || []}
                  isOver={overColumnId === stage.id}
                  isReadOnly={isReadOnly}
                  onAdvance={handleAdvance}
                  onReject={handleReject}
                  onView={handleView}
                />
              ))}
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeCandidate ? (
                <div className="w-[260px] opacity-90 rotate-2">
                  <CandidateCard application={activeCandidate} isReadOnly />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
}
