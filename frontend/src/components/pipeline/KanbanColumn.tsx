import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';
import CandidateCard, { type PipelineCandidate } from './CandidateCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  stageId: string;
  stageLabel: string;
  candidates: PipelineCandidate[];
  isOver?: boolean;
  isReadOnly?: boolean;
  onAdvance?: (id: string) => void;
  onReject?: (id: string) => void;
  onView?: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KanbanColumn({
  stageId,
  stageLabel,
  candidates,
  isOver = false,
  isReadOnly = false,
  onAdvance,
  onReject,
  onView,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: stageId });
  const [menuOpen, setMenuOpen] = useState(false);

  const candidateIds = candidates.map((c) => c._id);

  return (
    <div
      className={`flex flex-col min-w-[280px] w-[280px] shrink-0 bg-neutral-50 rounded-xl border transition-all duration-200
        ${isOver ? 'border-primary-400 ring-2 ring-primary-100' : 'border-neutral-200'}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-800">{stageLabel}</h3>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-neutral-200 text-neutral-600">
            {candidates.length}
          </span>
        </div>
        {/* Column menu */}
        {!isReadOnly && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 text-neutral-400 hover:text-neutral-600 rounded hover:bg-neutral-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-40">
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    Add candidate
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    Email all
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Card List */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-220px)] relative">
        <SortableContext items={candidateIds} strategy={verticalListSortingStrategy}>
          {candidates.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-neutral-400 italic">
              No candidates
            </div>
          ) : (
            candidates.map((candidate) => (
              <CandidateCard
                key={candidate._id}
                application={candidate}
                isReadOnly={isReadOnly}
                onAdvance={onAdvance}
                onReject={onReject}
                onView={onView}
              />
            ))
          )}
        </SortableContext>

        {/* Drop zone overlay */}
        {isOver && (
          <div className="absolute inset-2 rounded-lg border-2 border-dashed border-primary-400 bg-primary-50/50 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-medium text-primary-600">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}
