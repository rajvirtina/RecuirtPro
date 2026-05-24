import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  _id: string;
  question: string;
  questionType: string;
  difficulty: string;
  skills: string[];
  usageCount: number;
  averageRating?: number;
  createdAt: string;
}

interface Job {
  _id: string;
  title: string;
  skills: string[];
}

interface GeneratedQuestion {
  _tempId: number;
  question: string;
  questionType: string;
  difficulty: string;
  skills: string[];
  expectedAnswer?: string;
  estimatedDuration: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_STYLE: Record<string, string> = {
  junior: 'bg-green-100 text-green-800',
  easy:   'bg-green-100 text-green-800',
  senior: 'bg-yellow-100 text-yellow-800',
  medium: 'bg-yellow-100 text-yellow-800',
  expert: 'bg-red-100 text-red-800',
  hard:   'bg-red-100 text-red-800',
};

const TYPE_STYLE: Record<string, string> = {
  technical:     'bg-blue-100 text-blue-800',
  behavioral:    'bg-purple-100 text-purple-800',
  situational:   'bg-indigo-100 text-indigo-800',
  coding:        'bg-cyan-100 text-cyan-800',
  system_design: 'bg-teal-100 text-teal-800',
  hr:            'bg-pink-100 text-pink-800',
};

const COUNTS = [5, 10, 15, 20];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Questions() {
  const user = useAuthStore((state) => state.user);

  // ── Question bank state ──────────────────────────────────────────────────
  const [questions, setQuestions]           = useState<Question[]>([]);
  const [loading, setLoading]               = useState(true);
  const [filter, setFilter]                 = useState('all');

  // ── Create modal state ───────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    questionType: 'technical',
    difficulty: 'senior',
    skills: [] as string[],
    expectedAnswer: '',
    estimatedDuration: 5,
  });
  const [skillInput, setSkillInput] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Generate from Job modal state ────────────────────────────────────────
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [jobs, setJobs]                           = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading]             = useState(false);
  const [generateJobId, setGenerateJobId]         = useState('');
  const [generateCount, setGenerateCount]         = useState(10);
  const [generating, setGenerating]               = useState(false);

  // Review phase
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [selectedTempIds, setSelectedTempIds]       = useState<Set<number>>(new Set());
  const [savingGenerated, setSavingGenerated]       = useState(false);
  const [reviewJobTitle, setReviewJobTitle]         = useState('');

  // ── Fetch questions ──────────────────────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const url = filter === 'all' ? '/questions' : `/questions?difficulty=${filter}`;
      const res = await apiClient.get(url);
      // Handle both array and paginated { data: [] } response shapes
      const raw = (res.data as any);
      setQuestions(Array.isArray(raw) ? raw : (raw?.data ?? []));
    } catch {
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // ── Fetch jobs (once when generate modal opens) ──────────────────────────
  useEffect(() => {
    if (!showGenerateModal || jobs.length > 0) return;
    setJobsLoading(true);
    apiClient
      .get('/jobs?limit=100')
      .then((res) => {
        const raw = (res.data as any);
        const list: Job[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
        setJobs(list);
        if (list.length > 0) setGenerateJobId(list[0]._id);
      })
      .catch(() => toast.error('Failed to load jobs'))
      .finally(() => setJobsLoading(false));
  }, [showGenerateModal, jobs.length]);

  // ── Create single question ───────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.question.trim()) {
      toast.error('Question text is required');
      return;
    }
    try {
      setCreating(true);
      await apiClient.post('/questions', newQuestion);
      toast.success('Question added to bank');
      setShowCreateModal(false);
      setNewQuestion({ question: '', questionType: 'technical', difficulty: 'senior', skills: [], expectedAnswer: '', estimatedDuration: 5 });
      fetchQuestions();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create question');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question from the bank?')) return;
    try {
      await apiClient.delete(`/questions/${id}`);
      toast.success('Question deleted');
      fetchQuestions();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to delete question');
    }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !newQuestion.skills.includes(s)) {
      setNewQuestion({ ...newQuestion, skills: [...newQuestion.skills, s] });
      setSkillInput('');
    }
  };

  // ── Generate from job ────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!generateJobId) { toast.error('Please select a job'); return; }
    try {
      setGenerating(true);
      setGeneratedQuestions([]);
      const res = await apiClient.post('/questions/generate', { jobId: generateJobId, count: generateCount });
      const data = (res.data as any)?.data ?? res.data;
      const qs: GeneratedQuestion[] = data?.questions ?? [];
      if (qs.length === 0) {
        toast.warning('LLM returned no questions — the service may be offline. Try again or add questions manually.');
        return;
      }
      setGeneratedQuestions(qs);
      setSelectedTempIds(new Set(qs.map((q) => q._tempId))); // select all by default
      setReviewJobTitle(data?.jobTitle ?? '');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to generate questions');
    } finally {
      setGenerating(false);
    }
  };

  const toggleGenSelect = (tempId: number) => {
    setSelectedTempIds((prev) => {
      const next = new Set(prev);
      next.has(tempId) ? next.delete(tempId) : next.add(tempId);
      return next;
    });
  };

  const handleSaveGenerated = async () => {
    const toSave = generatedQuestions.filter((q) => selectedTempIds.has(q._tempId));
    if (toSave.length === 0) { toast.error('Select at least one question to save'); return; }
    try {
      setSavingGenerated(true);
      await apiClient.post('/questions/batch', { questions: toSave });
      toast.success(`${toSave.length} question${toSave.length > 1 ? 's' : ''} saved to bank`);
      setShowGenerateModal(false);
      setGeneratedQuestions([]);
      setSelectedTempIds(new Set());
      fetchQuestions();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save questions');
    } finally {
      setSavingGenerated(false);
    }
  };

  const closeGenerateModal = () => {
    setShowGenerateModal(false);
    setGeneratedQuestions([]);
    setSelectedTempIds(new Set());
    setGenerateJobId(jobs[0]?._id ?? '');
    setGenerateCount(10);
  };

  // ── Access guard ─────────────────────────────────────────────────────────
  if (user?.role !== 'employer' && user?.role !== 'admin' && user?.role !== 'hr') {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <h2 className="text-2xl font-bold text-neutral-900">Access Denied</h2>
        <p className="mt-2 text-neutral-500">Only HR, Admin, or Employer roles can manage questions.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Question Bank</h1>
          <p className="text-neutral-500 mt-1">
            {questions.length} question{questions.length !== 1 ? 's' : ''} ·
            curated for AI interviews
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-indigo-500 text-indigo-700 font-medium hover:bg-indigo-50 transition-colors"
          >
            ✨ Generate from Job
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            + Add Question
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap gap-2">
        {['all', 'junior', 'senior', 'expert'].map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
              filter === d
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-300'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* ── Question list ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-neutral-200">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-base font-semibold text-neutral-800">No questions yet</h3>
          <p className="text-sm text-neutral-500 mt-1 mb-4">
            Add questions manually or generate them from a job description.
          </p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            ✨ Generate from Job
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q._id} className="bg-white rounded-xl border border-neutral-200 p-5">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${DIFFICULTY_STYLE[q.difficulty] ?? 'bg-neutral-100 text-neutral-700'}`}>
                      {q.difficulty}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_STYLE[q.questionType] ?? 'bg-neutral-100 text-neutral-700'}`}>
                      {q.questionType?.replace(/_/g, ' ')}
                    </span>
                    {q.usageCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-500 text-xs">
                        used {q.usageCount}×
                      </span>
                    )}
                    {q.averageRating && (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs">
                        ★ {q.averageRating.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Question text */}
                  <p className="text-sm font-medium text-neutral-800 leading-snug">{q.question}</p>

                  {/* Skills */}
                  {q.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {q.skills.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-neutral-400">
                    Added {new Date(q.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(q._id)}
                  className="shrink-0 text-neutral-300 hover:text-red-500 transition-colors p-1"
                  title="Delete question"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          GENERATE FROM JOB MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-100">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Generate Questions from Job</h2>
                <p className="text-sm text-neutral-500 mt-0.5">
                  AI generates questions targeting the job's required skills.
                  Review and accept before saving to your bank.
                </p>
              </div>
              <button onClick={closeGenerateModal} className="text-neutral-400 hover:text-neutral-700 p-1 rounded">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* ── Configure phase ──────────────────────────────────── */}
              {generatedQuestions.length === 0 && (
                <>
                  {/* Job selector */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Job Position</label>
                    {jobsLoading ? (
                      <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
                    ) : jobs.length === 0 ? (
                      <p className="text-sm text-neutral-400 italic">No published jobs found. Create a job first.</p>
                    ) : (
                      <select
                        value={generateJobId}
                        onChange={(e) => setGenerateJobId(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {jobs.map((j) => (
                          <option key={j._id} value={j._id}>{j.title}</option>
                        ))}
                      </select>
                    )}

                    {/* Show skills for selected job */}
                    {generateJobId && (() => {
                      const job = jobs.find((j) => j._id === generateJobId);
                      return job?.skills?.length ? (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {job.skills.map((s) => (
                            <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">{s}</span>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Count */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Number of Questions</label>
                    <div className="flex gap-2">
                      {COUNTS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setGenerateCount(c)}
                          className={`px-4 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                            generateCount === c
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-neutral-200 text-neutral-600 hover:border-indigo-300'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1.5">
                      The AI will prioritise skills not yet covered by your existing bank.
                    </p>
                  </div>

                  {/* Action */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={closeGenerateModal}
                      className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={generating || !generateJobId || jobsLoading}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {generating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Generating…
                        </>
                      ) : (
                        '✨ Generate Questions'
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* ── Review phase ─────────────────────────────────────── */}
              {generatedQuestions.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">
                        {generatedQuestions.length} questions generated for <span className="text-indigo-700">{reviewJobTitle}</span>
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {selectedTempIds.size} selected · click a card to toggle
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTempIds(new Set(generatedQuestions.map((q) => q._tempId)))}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Select all
                      </button>
                      <span className="text-neutral-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTempIds(new Set())}
                        className="text-xs text-neutral-500 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {generatedQuestions.map((q) => {
                      const selected = selectedTempIds.has(q._tempId);
                      return (
                        <button
                          key={q._tempId}
                          type="button"
                          onClick={() => toggleGenSelect(q._tempId)}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            selected
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-neutral-200 bg-white hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox visual */}
                            <div className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${
                              selected ? 'border-indigo-500 bg-indigo-500' : 'border-neutral-300 bg-white'
                            }`}>
                              {selected && (
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                </svg>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Badges */}
                              <div className="flex flex-wrap gap-1.5 mb-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${DIFFICULTY_STYLE[q.difficulty] ?? 'bg-neutral-100 text-neutral-700'}`}>
                                  {q.difficulty}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_STYLE[q.questionType] ?? 'bg-neutral-100 text-neutral-700'}`}>
                                  {q.questionType?.replace(/_/g, ' ')}
                                </span>
                              </div>

                              {/* Question text */}
                              <p className="text-sm text-neutral-800 leading-snug">{q.question}</p>

                              {/* Skills */}
                              {q.skills?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {q.skills.map((s) => (
                                    <span key={s} className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded text-xs">{s}</span>
                                  ))}
                                </div>
                              )}

                              {/* Expected answer preview */}
                              {q.expectedAnswer && (
                                <p className="mt-1.5 text-xs text-neutral-400 italic line-clamp-2">
                                  💡 {q.expectedAnswer}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer (review phase only) */}
            {generatedQuestions.length > 0 && (
              <div className="flex items-center gap-3 p-6 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => { setGeneratedQuestions([]); setSelectedTempIds(new Set()); }}
                  className="px-4 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-600 hover:bg-neutral-50 font-medium"
                >
                  ← Back
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={closeGenerateModal}
                  className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700"
                >
                  Discard all
                </button>
                <button
                  type="button"
                  onClick={handleSaveGenerated}
                  disabled={savingGenerated || selectedTempIds.size === 0}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingGenerated ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    `Save ${selectedTempIds.size} to Bank`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CREATE QUESTION MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-neutral-900">Add Question</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-neutral-400 hover:text-neutral-700">✕</button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                {/* Question text */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Question <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newQuestion.question}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Explain the difference between REST and GraphQL..."
                    required
                  />
                </div>

                {/* Type + Difficulty */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Type</label>
                    <select
                      value={newQuestion.questionType}
                      onChange={(e) => setNewQuestion({ ...newQuestion, questionType: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="technical">Technical</option>
                      <option value="behavioral">Behavioral</option>
                      <option value="situational">Situational</option>
                      <option value="coding">Coding</option>
                      <option value="system_design">System Design</option>
                      <option value="hr">HR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Difficulty</label>
                    <select
                      value={newQuestion.difficulty}
                      onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="junior">Junior</option>
                      <option value="senior">Senior</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                </div>

                {/* Expected answer */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Expected Answer <span className="text-neutral-400 font-normal">(optional — helps AI evaluation)</span>
                  </label>
                  <textarea
                    value={newQuestion.expectedAnswer}
                    onChange={(e) => setNewQuestion({ ...newQuestion, expectedAnswer: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="Key points the candidate should cover..."
                  />
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Skills</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                      className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. React"
                    />
                    <button type="button" onClick={addSkill}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {newQuestion.skills.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-sm flex items-center gap-1">
                        {s}
                        <button type="button" onClick={() => setNewQuestion({ ...newQuestion, skills: newQuestion.skills.filter((x) => x !== s) })} className="hover:text-indigo-900">×</button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Estimated duration */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Estimated Duration (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={newQuestion.estimatedDuration}
                    onChange={(e) => setNewQuestion({ ...newQuestion, estimatedDuration: parseInt(e.target.value) || 5 })}
                    className="w-28 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={creating}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                    {creating ? 'Saving…' : 'Save Question'}
                  </button>
                  <button type="button" onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
