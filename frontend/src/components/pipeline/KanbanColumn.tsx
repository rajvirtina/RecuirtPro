import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import CandidateCard, { type PipelineCandidate } from './CandidateCard';
import { spring, dur } from '../../lib/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  stageId:     string;
  stageLabel:  string;
  candidates:  PipelineCandidate[];
  isOver?:     boolean;
  isReadOnly?: boolean;
  onAdvance?:  (id: string) => void;
  onReject?:   (id: string) => void;
  onView?:     (id: string) => void;
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
  const reduced = useReducedMotion();
  const { setNodeRef: setDropRef } = useDroppable({ id: stageId });

  // @formkit/auto-animate — handles add/remove/reorder of cards
  const [listRef] = useAutoAnimate<HTMLDivElement>({
    duration: reduced ? 0 : 200,
    easing: 'ease-out',
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const candidateIds = candidates.map((c) => c._id);

  // Badge bump animation when count changes
  const prevCount    = useRef(candidates.length);
  const [bumping, setBumping] = useState(false);
  useEffect(() => {
    if (candidates.length !== prevCount.current && !reduced) {
      setBumping(true);
      const t = setTimeout(() => setBumping(false), 400);
      prevCount.current = candidates.length;
      return () => clearTimeout(t);
    }
    prevCount.current = candidates.length;
  }, [candidates.length, reduced]);

  return (
    <motion.div
      className="flex flex-col min-w-[280px] w-[280px] shrink-0 rounded-xl border"
      animate={
        isOver && !reduced
          ? { borderColor: '#6366f1', backgroundColor: 'rgb(238 242 255)', scale: 1.01 }
          : { borderColor: '#e2e2ec', backgroundColor: 'rgb(248 248 252)', scale: 1 }
      }
      transition={spring.settle}
      style={{ willChange: 'transform, border-color, background-color' }}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-800">{stageLabel}</h3>
          <motion.span
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-neutral-200 text-neutral-600"
            animate={bumping && !reduced ? { scale: 1.35 } : { scale: 1 }}
            transition={spring.badge}
          >
            {candidates.length}
          </motion.span>
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

            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    className="absolute right-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-40"
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0,  scale: 1     }}
                    exit={  { opacity: 0, y: -4, scale: 0.96  }}
                    transition={{ duration: dur.fast }}
                  >
                    <button type="button" onClick={() => setMenuOpen(false)}
                      className="w-full text-left px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50">
                      Add candidate
                    </button>
                    <button type="button" onClick={() => setMenuOpen(false)}
                      className="w-full text-left px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50">
                      Email all
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Card List — setDropRef on the droppable wrapper, listRef for auto-animate */}
      <div ref={setDropRef} className="flex-1 overflow-y-auto p-2 max-h-[calc(100vh-220px)] relative">
        <SortableContext items={candidateIds} strategy={verticalListSortingStrategy}>
          <div ref={listRef} className="space-y-2">
            {candidates.length === 0 ? (
              <motion.div
                key="empty"
                className="flex flex-col items-center justify-center h-24 gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={  { opacity: 0 }}
                transition={{ duration: dur.base }}
              >
                {/* Subtle animated icon */}
                <motion.div
                  className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center"
                  animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </motion.div>
                <p className="text-xs text-neutral-400 italic">No candidates</p>
              </motion.div>
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
          </div>
        </SortableContext>

        {/* Drop zone overlay */}
        <AnimatePresence>
          {isOver && (
            <motion.div
              className="absolute inset-2 rounded-lg border-2 border-dashed border-primary-400 bg-primary-50/60 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={  { opacity: 0 }}
              transition={{ duration: dur.fast }}
            >
              <span className="text-xs font-medium text-primary-600">Drop here</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
