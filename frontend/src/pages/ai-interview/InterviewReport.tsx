/**
 * InterviewReport — FutureMug-structured AI Interview Evaluation Report
 *
 * Section order exactly matches FutureMug report layout:
 *   Header → Overall Summary → Strengths → Areas of Improvement →
 *   Technical Skills (pie + cards) → Behavioral Skills (7 bars) →
 *   Candidate Snapshot → Complete Q&A Transcript → Hiring Recommendation
 *
 * Route: /ai-interview/:interviewId/report  (HR / Admin / Employer)
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import apiClient from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportMetadata {
  candidate_name:          string;
  candidate_email:         string;
  candidate_phone:         string;
  position:                string;
  company:                 string;
  interview_date:          string;
  interviewer:             string;
  report_generated_at:     string;
  recording_url:           string | null;
  candidate_snapshot_url:  string | null;
  video_enrichment_status: 'complete' | 'pending';
}

interface OverallSection {
  rating_score:      number;
  rating_label:      string;
  summary_narrative: string;
}

interface TechnicalSkill {
  skill_name:               string;
  score:                    number;
  years_experience:         number;
  type_demonstrated:        string;
  proficiency_demonstrated: string;
  expected_score:           number;
  gap:                      number;
  gap_label:                string;
  jd_required:              boolean;
  assessed:                 boolean;
  ai_comment:               string;
}

interface BehavioralSkill {
  skill_name:     string;
  score:          number;
  expected_score: number;
  ai_comment:     string;
}

interface QAItem {
  question_number:     number;
  question_text:       string;
  answer_text:         string;
  answer_quality_note: string;
  skills_assessed:     string[];
  timestamp_seconds:   number | null; // null = not yet enriched by video engine
  video_enriched:      boolean;
}

interface UnassessedSkill {
  skill:         string;
  jd_importance: string;
  hiring_risk:   string;
}

interface HiringRecommendation {
  recommendation:       string;
  confidence:           string;
  rationale:            string;
  suggested_next_steps: string[];
}

interface Report {
  report_metadata:            ReportMetadata;
  overall:                    OverallSection;
  strengths:                  string[];
  areas_of_improvement:       string[];
  technical_skills:           TechnicalSkill[];
  behavioral_skills:          BehavioralSkill[];
  behavioral_summary_comment: string;
  qa_transcript:              QAItem[];
  unassessed_jd_skills:       UnassessedSkill[];
  hiring_recommendation:      HiringRecommendation;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const PIE_COLORS = ['#0d9488','#0891b2','#7c3aed','#db2777','#ea580c','#65a30d','#ca8a04'];

function ratingBadge(score: number): { bg: string; text: string; border: string } {
  if (score >= 8) return { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' };
  if (score >= 6) return { bg: 'bg-teal-500',    text: 'text-white', border: 'border-teal-600'    };
  if (score >= 4) return { bg: 'bg-amber-500',   text: 'text-white', border: 'border-amber-600'   };
  return              { bg: 'bg-red-500',     text: 'text-white', border: 'border-red-600'     };
}

function scoreBarColor(score: number): string {
  if (score >= 8) return 'bg-emerald-500';
  if (score >= 6) return 'bg-teal-500';
  if (score >= 4) return 'bg-amber-500';
  return 'bg-red-400';
}

function gapBadge(label: string): string {
  if (label === 'Above')      return 'bg-emerald-100 text-emerald-700';
  if (label === 'On Target')  return 'bg-teal-100 text-teal-700';
  return 'bg-red-100 text-red-700';
}

const REC_STYLE: Record<string, { bg: string; text: string }> = {
  'Strong Hire': { bg: 'bg-emerald-600', text: 'text-white' },
  'Hire':        { bg: 'bg-emerald-500', text: 'text-white' },
  'Hold':        { bg: 'bg-amber-500',   text: 'text-white' },
  'No Hire':     { bg: 'bg-red-500',     text: 'text-white' },
  'Strong No Hire': { bg: 'bg-red-700',  text: 'text-white' },
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100 bg-neutral-50">
        <span className="text-xl">{icon}</span>
        <h2 className="text-sm font-bold text-neutral-800 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Donut chart (CSS + SVG, no JS animation lib needed) ─────────────────────

function DonutScore({ score, label }: { score: number; label: string }) {
  const pct   = Math.min(100, (score / 10) * 100);
  const r     = 52;
  const circ  = 2 * Math.PI * r;
  const rb    = ratingBadge(score);
  const color = score >= 8 ? '#10b981' : score >= 6 ? '#0d9488' : score >= 4 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="136" height="136" viewBox="0 0 136 136">
          <circle cx="68" cy="68" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
          <motion.circle
            cx="68" cy="68" r={r} fill="none"
            stroke={color} strokeWidth="14"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            strokeLinecap="round"
            transform="rotate(-90 68 68)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-neutral-900 leading-none">{score.toFixed(1)}</span>
          <span className="text-xs text-neutral-500 mt-0.5">out of 10</span>
        </div>
      </div>
      <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${rb.bg} ${rb.text}`}>{label}</span>
    </div>
  );
}

// ─── Technical skill card ─────────────────────────────────────────────────────

function TechSkillCard({ skill, index }: { skill: TechnicalSkill; index: number }) {
  const achieved = Math.min(100, (skill.score / 10) * 100);
  const expected = Math.min(100, (skill.expected_score / 10) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="border border-neutral-200 rounded-xl p-5 space-y-4"
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-neutral-900">{skill.skill_name}</h3>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700">
              {skill.type_demonstrated}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-neutral-100 text-neutral-600">
              {skill.proficiency_demonstrated}
            </span>
            {skill.years_experience > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-sky-50 text-sky-700">
                {skill.years_experience} yr{skill.years_experience !== 1 ? 's' : ''}
              </span>
            )}
            {skill.jd_required && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700">
                JD Required
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-extrabold text-neutral-900 leading-none">{skill.score.toFixed(1)}</p>
          <p className="text-[10px] text-neutral-400">/ 10</p>
        </div>
      </div>

      {/* Score bar: achieved vs expected */}
      <div className="space-y-1.5">
        <div className="relative h-3 bg-neutral-100 rounded-full overflow-hidden">
          {/* Expected marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-neutral-500 z-10"
            style={{ left: `${expected}%` }}
          />
          <motion.div
            className={`h-full rounded-full ${scoreBarColor(skill.score)}`}
            initial={{ width: 0 }}
            animate={{ width: `${achieved}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: index * 0.07 }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-neutral-500">
            Expected: <strong>{skill.expected_score.toFixed(1)}</strong>
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${gapBadge(skill.gap_label)}`}>
            {skill.gap_label}
          </span>
        </div>
      </div>

      {/* AI comment */}
      {skill.ai_comment && (
        <p className="text-xs text-neutral-500 leading-relaxed border-t border-neutral-100 pt-3">
          {skill.ai_comment}
        </p>
      )}
    </motion.div>
  );
}

// ─── Behavioral skill bar ─────────────────────────────────────────────────────

function BehavioralBar({ skill, index }: { skill: BehavioralSkill; index: number }) {
  const achieved = Math.min(100, (skill.score / 10) * 100);
  const expected = Math.min(100, (skill.expected_score / 10) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-neutral-700 w-40 flex-shrink-0">{skill.skill_name}</span>
        <div className="flex-1 relative h-3 bg-neutral-100 rounded-full overflow-hidden">
          {/* Expected marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-neutral-400 z-10"
            style={{ left: `${expected}%` }}
          />
          {/* Achieved (green if above/on-target, red if below) */}
          <motion.div
            className={`h-full rounded-full ${skill.score >= skill.expected_score ? 'bg-emerald-500' : 'bg-red-400'}`}
            initial={{ width: 0 }}
            animate={{ width: `${achieved}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: index * 0.06 }}
          />
        </div>
        <span className="text-sm font-bold text-neutral-800 w-8 text-right tabular-nums">
          {skill.score.toFixed(1)}
        </span>
      </div>
      {skill.ai_comment && (
        <p className="text-[11px] text-neutral-400 leading-relaxed pl-[168px]">{skill.ai_comment}</p>
      )}
    </div>
  );
}

// ─── Q&A accordion ────────────────────────────────────────────────────────────

function QAAccordion({ items, recordingUrl }: { items: QAItem[]; recordingUrl: string | null }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.question_number} className="border border-neutral-200 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors text-left"
            onClick={() => setOpen(open === item.question_number ? null : item.question_number)}
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center">
              Q{item.question_number}
            </span>
            <span className="flex-1 text-sm font-medium text-neutral-800 truncate">
              {item.question_text}
            </span>
            <span className="text-neutral-400 text-xs flex-shrink-0">
              {open === item.question_number ? '▲' : '▼'}
            </span>
          </button>
          <AnimatePresence>
            {open === item.question_number && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-4 border-t border-neutral-200 space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Question</p>
                    <p className="text-sm text-neutral-800">{item.question_text}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Candidate Answer</p>
                    <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{item.answer_text}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">AI Assessment</p>
                    <p className="text-xs text-blue-700">{item.answer_quality_note}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.skills_assessed.map(s => (
                      <span key={s} className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium capitalize">
                        {s}
                      </span>
                    ))}
                    {/* P0-04: only show jump link when timestamp has been enriched */}
                    {recordingUrl && item.video_enriched && item.timestamp_seconds != null && (
                      <a
                        href={`${recordingUrl}?t=${item.timestamp_seconds}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-purple-600 underline ml-auto"
                      >
                        ▶ Jump to video ({item.timestamp_seconds}s)
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InterviewReport() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const [report,  setReport]  = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!interviewId) return;
    apiClient
      .get(`/ai-interviews/${interviewId}/report`)
      .then(r => setReport((r.data as any).data.report))
      .catch(e => setError(e.response?.data?.message || 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [interviewId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-neutral-500">Loading report…</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center space-y-3">
          <p className="text-red-600 font-medium">{error || 'Report not available'}</p>
          <Link to="/ai-scores" className="text-sm text-teal-600 underline">← Back</Link>
        </div>
      </div>
    );
  }

  const {
    report_metadata: meta,
    overall,
    strengths,
    areas_of_improvement,
    technical_skills,
    behavioral_skills,
    behavioral_summary_comment,
    qa_transcript,
    unassessed_jd_skills,
    hiring_recommendation,
  } = report;

  const rb      = ratingBadge(overall.rating_score);
  const recStyle = REC_STYLE[hiring_recommendation.recommendation] || { bg: 'bg-neutral-600', text: 'text-white' };

  // Recharts pie data
  const pieData = technical_skills
    .filter(s => s.assessed && s.score > 0)
    .map(s => ({ name: s.skill_name, value: s.score }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 print:space-y-4">

      {/* ── HEADER BLOCK ── */}
      <div className="rounded-2xl overflow-hidden shadow-md">
        <div className="bg-gradient-to-r from-teal-700 to-teal-500 px-8 py-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-teal-200 text-[10px] uppercase tracking-widest mb-1 font-semibold">
                AI Interview Evaluation Report
              </p>
              <h1 className="text-2xl font-extrabold truncate">{meta.candidate_name}</h1>
              <p className="text-teal-100 text-sm mt-1 font-medium">
                {meta.position} &nbsp;·&nbsp; {meta.company}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-teal-100">
                {meta.candidate_email && <span>✉ {meta.candidate_email}</span>}
                {meta.candidate_phone && <span>📞 {meta.candidate_phone}</span>}
                <span>📅 {meta.interview_date}</span>
                <span>👤 {meta.interviewer}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${rb.bg} ${rb.text} shadow`}>
                {overall.rating_label}
              </span>
              {/* P2-05: only render when recording URL is confirmed non-null */}
              {meta.recording_url && (
                <a
                  href={meta.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full transition-colors"
                >
                  ▶ Watch Recording
                  {meta.video_enrichment_status === 'pending' && (
                    <span className="ml-1.5 text-yellow-200 text-[9px]">(processing…)</span>
                  )}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: Overall Summary ── */}
      <Section title="Overall Summary" icon="📊">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <DonutScore score={overall.rating_score} label={overall.rating_label} />
          <p className="flex-1 text-sm text-neutral-600 leading-relaxed">{overall.summary_narrative}</p>
        </div>
      </Section>

      {/* ── SECTION 2: Strengths ── */}
      <Section title="Strengths" icon="✅">
        <ul className="space-y-2">
          {strengths.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-neutral-700">
              <span className="text-emerald-500 flex-shrink-0 font-bold mt-0.5">•</span>
              <span>{s}</span>
            </li>
          ))}
          {strengths.length === 0 && (
            <p className="text-sm text-neutral-400 italic">No specific strengths noted.</p>
          )}
        </ul>
      </Section>

      {/* ── SECTION 3: Areas of Improvement ── */}
      <Section title="Areas of Improvement" icon="📈">
        <ul className="space-y-2">
          {areas_of_improvement.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-neutral-700">
              <span className="text-amber-500 flex-shrink-0 font-bold mt-0.5">•</span>
              <span>{s}</span>
            </li>
          ))}
          {areas_of_improvement.length === 0 && (
            <p className="text-sm text-neutral-400 italic">No specific improvements noted.</p>
          )}
        </ul>
      </Section>

      {/* ── SECTION 4: Technical Skills ── */}
      <Section title="Technical Skills" icon="🛠️">
        {/* Unassessed skill alert */}
        {unassessed_jd_skills.length > 0 && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-bold text-red-700 mb-2">
              🚨 {unassessed_jd_skills.length} JD-required skill{unassessed_jd_skills.length > 1 ? 's' : ''} not assessed — High Hiring Risk
            </p>
            <div className="flex flex-wrap gap-2">
              {unassessed_jd_skills.map(u => (
                <span key={u.skill} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                  {u.skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="mb-6 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}`}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)} / 10`, 'Score']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-skill cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {technical_skills.map((skill, i) => (
            <TechSkillCard key={skill.skill_name} skill={skill} index={i} />
          ))}
        </div>
      </Section>

      {/* ── SECTION 5: Behavioral Skills ── */}
      <Section title="Behavioral Skills" icon="🧠">
        <div className="space-y-5">
          {behavioral_skills.map((skill, i) => (
            <BehavioralBar key={skill.skill_name} skill={skill} index={i} />
          ))}
        </div>
        {behavioral_summary_comment && (
          <p className="mt-5 pt-4 border-t border-neutral-100 text-sm text-neutral-500 leading-relaxed">
            {behavioral_summary_comment}
          </p>
        )}
      </Section>

      {/* P2-05: gated on non-null recording URL */}
      {meta.recording_url && (
        <Section title="Interview Recording" icon="📹">
          <video
            src={meta.recording_url}
            controls
            className="w-full rounded-lg bg-black"
            style={{ maxHeight: 360 }}
          />
          {meta.video_enrichment_status === 'pending' && (
            <p className="text-xs text-amber-600 mt-2">
              ⏳ Video enrichment (timestamps + annotations) is still processing. Refresh the report after a few minutes to enable Q&amp;A jump links.
            </p>
          )}
        </Section>
      )}

      {/* ── SECTION 6: Candidate Interview Snapshot ── */}
      {meta.candidate_snapshot_url && (
        <Section title="Candidate Interview Snapshot" icon="📸">
          <div className="flex items-center gap-6">
            <img
              src={meta.candidate_snapshot_url}
              alt="Candidate snapshot"
              className="w-32 h-32 rounded-xl object-cover border-2 border-neutral-200 shadow"
            />
            <div className="space-y-1 text-sm text-neutral-600">
              <p><span className="font-semibold">Name:</span> {meta.candidate_name}</p>
              <p><span className="font-semibold">Position:</span> {meta.position}</p>
              <p><span className="font-semibold">Interview Date:</span> {meta.interview_date}</p>
              {meta.candidate_email && <p><span className="font-semibold">Email:</span> {meta.candidate_email}</p>}
            </div>
          </div>
        </Section>
      )}

      {/* ── SECTION 7: Complete Interview Q&A ── */}
      {qa_transcript.length > 0 && (
        <Section title={`Complete Interview Q&A — ${qa_transcript.length} Questions`} icon="💬">
          <QAAccordion items={qa_transcript} recordingUrl={meta.recording_url} />
        </Section>
      )}

      {/* ── HIRING RECOMMENDATION (bottom banner) ── */}
      <div className={`rounded-2xl p-6 ${recStyle.bg} shadow-md`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex-1">
            <p className={`text-[10px] uppercase tracking-widest font-semibold ${recStyle.text} opacity-70 mb-1`}>
              Hiring Recommendation
            </p>
            <h2 className={`text-2xl font-extrabold ${recStyle.text}`}>
              {hiring_recommendation.recommendation}
            </h2>
            <p className={`text-sm mt-2 ${recStyle.text} opacity-90 leading-relaxed`}>
              {hiring_recommendation.rationale}
            </p>
          </div>
          <div className={`border-l border-white/20 pl-5 text-right flex-shrink-0 ${recStyle.text}`}>
            <p className="text-xs opacity-70 mb-0.5">Confidence</p>
            <p className="text-xl font-bold">{hiring_recommendation.confidence}</p>
          </div>
        </div>
        {hiring_recommendation.suggested_next_steps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className={`text-xs font-semibold ${recStyle.text} opacity-70 mb-2`}>Suggested Next Steps</p>
            <ul className="space-y-1">
              {hiring_recommendation.suggested_next_steps.map((step, i) => (
                <li key={i} className={`text-xs ${recStyle.text} opacity-90 flex gap-2`}>
                  <span>→</span><span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-neutral-400 pb-4">
        Report generated {new Date(meta.report_generated_at).toLocaleString()} &nbsp;·&nbsp; AI Interview Platform
      </p>
    </div>
  );
}
