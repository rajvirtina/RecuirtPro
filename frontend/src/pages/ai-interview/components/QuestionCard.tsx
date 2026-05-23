/**
 * QuestionCard
 * Displays the current interview question with type badge, text, and timing hint.
 */

import React from 'react';

export interface Question {
  id: string;
  text: string;
  type: string;
  expectedDurationSeconds: number;
  orderIndex: number;
}

interface Props {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  elapsedQuestionSec?: number;
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  technical:   { label: 'Technical Question',   color: 'text-blue-600 bg-blue-50 border-blue-200' },
  behavioral:  { label: 'Behavioural Question',  color: 'text-violet-600 bg-violet-50 border-violet-200' },
  situational: { label: 'Situational Question',  color: 'text-amber-600 bg-amber-50 border-amber-200' },
  hr:          { label: 'HR Question',           color: 'text-teal-600 bg-teal-50 border-teal-200' },
};

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  elapsedQuestionSec,
}: Props) {
  const meta  = TYPE_META[question.type] ?? { label: question.type.replace(/_/g, ' ').toUpperCase(), color: 'text-neutral-600 bg-neutral-100 border-neutral-200' };
  const suggestedMin = Math.ceil(question.expectedDurationSeconds / 60);
  const isOverTime = elapsedQuestionSec != null && elapsedQuestionSec > question.expectedDurationSeconds * 1.4;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-2xl w-full">
      {/* Type badge */}
      <span className={`inline-block text-xs font-mono font-semibold uppercase tracking-widest px-2.5 py-1 rounded-md border mb-5 ${meta.color}`}>
        {meta.label}
      </span>

      {/* Question text */}
      <p className="text-xl font-semibold text-neutral-900 leading-relaxed mb-5">
        {question.text}
      </p>

      {/* Footer row */}
      <div className="flex items-center justify-between text-xs text-neutral-400 pt-4 border-t border-neutral-100">
        <span>
          Suggested time: ~{suggestedMin} {suggestedMin === 1 ? 'minute' : 'minutes'}
        </span>
        <div className="flex items-center gap-3">
          {elapsedQuestionSec != null && elapsedQuestionSec > 0 && (
            <span className={`flex items-center gap-1 ${isOverTime ? 'text-amber-500 font-medium' : ''}`}>
              {isOverTime && (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              )}
              {fmtSec(elapsedQuestionSec)} elapsed
            </span>
          )}
          <span className="text-neutral-300">|</span>
          <span>Q{questionNumber}/{totalQuestions}</span>
        </div>
      </div>
    </div>
  );
}
