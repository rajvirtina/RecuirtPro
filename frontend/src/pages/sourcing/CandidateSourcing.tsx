import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';

// ─── Types ───────────────────────────────────────────────────────
interface Integration {
  _id: string;
  platform: string;
  status: string;
  connectedAt?: string;
  expiresAt?: string;
}

interface MatchDetails {
  skillScore: number;
  experienceScore: number;
  locationScore: number;
  semanticScore: number;
  recencyScore: number;
  strengths: string[];
  missingSkills: string[];
  recommendation: string;
  confidenceScore: number;
}

interface CandidateProfile {
  _id?: string;
  source: string;
  externalId?: string;
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  currentCompany?: string;
  currentPosition?: string;
  experience?: number;
  skills: string[];
  education?: string[];
  summary?: string;
  profileUrl?: string;
  imageUrl?: string;
  matchScore?: number;
  matchDetails?: MatchDetails;
  githubData?: {
    repos: number;
    followers: number;
    topLanguages: string[];
    contributionScore: number;
  };
  status?: string;
}

interface SourcingStats {
  totalSourced: number;
  byPlatform: Record<string, number>;
  byStatus: Record<string, number>;
  avgMatchScore: number;
  recentSearches: number;
}

// ─── Score Bar ───────────────────────────────────────────────────
const ScoreBar = ({ label, score, color }: { label: string; score: number; color: string }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-20 text-gray-500 truncate">{label}</span>
    <div className="flex-1 bg-gray-200 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
    </div>
    <span className="w-8 text-right font-medium">{score}%</span>
  </div>
);

// ─── Platform Badge ──────────────────────────────────────────────
const PlatformBadge = ({ platform }: { platform: string }) => {
  const colors: Record<string, string> = {
    linkedin: 'bg-blue-100 text-blue-800',
    naukri: 'bg-purple-100 text-purple-800',
    github: 'bg-gray-800 text-white',
  };
  const icons: Record<string, string> = { linkedin: 'in', naukri: 'N', github: '⌘' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[platform] || 'bg-gray-100 text-gray-700'}`}>
      {icons[platform] || '?'} {platform}
    </span>
  );
};

// ─── Status Badge ────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    sourced: 'bg-gray-100 text-gray-700',
    shortlisted: 'bg-yellow-100 text-yellow-800',
    contacted: 'bg-blue-100 text-blue-800',
    responded: 'bg-green-100 text-green-800',
    in_pipeline: 'bg-indigo-100 text-indigo-800',
    rejected: 'bg-red-100 text-red-700',
    saved: 'bg-emerald-100 text-emerald-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

// ─── Main Component ──────────────────────────────────────────────
export default function CandidateSourcing() {
  const user = useAuthStore((s) => s.user);

  // Tab state
  const [activeTab, setActiveTab] = useState<'search' | 'saved' | 'integrations' | 'stats'>('search');

  // Search state
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [sources, setSources] = useState({ linkedin: true, naukri: true, github: false });
  const [criteria, setCriteria] = useState({
    skills: [] as string[],
    location: '',
    experienceMin: 0,
    experienceMax: 10,
    maxResults: 25,
  });
  const [skillInput, setSkillInput] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  // Saved candidates
  const [savedCandidates, setSavedCandidates] = useState<CandidateProfile[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedFilter, setSavedFilter] = useState('');

  // Integrations
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [intLoading, setIntLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<SourcingStats | null>(null);

  // ── Fetch helpers ────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    try {
      const res = await apiClient.get('/jobs?limit=100');
      setJobs(res.data?.data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchIntegrations = useCallback(async () => {
    setIntLoading(true);
    try {
      const res = await apiClient.get('/sourcing/integrations');
      setIntegrations(res.data?.data || []);
    } catch { /* ignore */ } finally { setIntLoading(false); }
  }, []);

  const fetchSavedCandidates = useCallback(async () => {
    setSavedLoading(true);
    try {
      const url = savedFilter
        ? `/sourcing/candidates?status=${savedFilter}`
        : '/sourcing/candidates';
      const res = await apiClient.get(url);
      setSavedCandidates(res.data?.data || []);
    } catch { /* ignore */ } finally { setSavedLoading(false); }
  }, [savedFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get('/sourcing/stats');
      setStats(res.data?.data || null);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => {
    if (activeTab === 'integrations') fetchIntegrations();
    if (activeTab === 'saved') fetchSavedCandidates();
    if (activeTab === 'stats') fetchStats();
  }, [activeTab, fetchIntegrations, fetchSavedCandidates, fetchStats]);

  // ── Search ─────────────────────────────────────────────────
  const handleSearch = async () => {
    const selected = Object.entries(sources).filter(([, v]) => v).map(([k]) => k);
    if (!selected.length) { setMessage({ type: 'error', text: 'Select at least one source' }); return; }

    setLoading(true); setMessage({ type: '', text: '' }); setCandidates([]);
    try {
      let res;
      if (selectedJob) {
        res = await apiClient.post(`/sourcing/jobs/${selectedJob}/candidates`, {
          sources: selected, maxResults: criteria.maxResults,
        });
      } else {
        res = await apiClient.post('/sourcing/search', {
          sources: selected,
          criteria: {
            skills: criteria.skills,
            location: criteria.location || undefined,
            experienceMin: criteria.experienceMin,
            experienceMax: criteria.experienceMax,
            maxResults: criteria.maxResults,
          },
        });
      }
      const data = res.data?.data?.candidates || [];
      setCandidates(data);
      setMessage({ type: 'success', text: `Found ${data.length} candidates from ${selected.join(', ')}` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Search failed' });
    } finally { setLoading(false); }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !criteria.skills.includes(s)) {
      setCriteria({ ...criteria, skills: [...criteria.skills, s] });
      setSkillInput('');
    }
  };

  const saveCandidate = async (candidate: CandidateProfile, idx: number) => {
    try {
      await apiClient.post('/sourcing/candidates', {
        platform: candidate.source,
        externalId: candidate.externalId || `${candidate.source}-${idx}`,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        location: candidate.location,
        currentCompany: candidate.currentCompany,
        currentPosition: candidate.currentPosition,
        experience: candidate.experience,
        skills: candidate.skills,
        education: candidate.education,
        summary: candidate.summary,
        profileUrl: candidate.profileUrl,
        imageUrl: candidate.imageUrl,
        matchScore: candidate.matchScore,
        matchDetails: candidate.matchDetails,
        githubData: candidate.githubData,
        jobId: selectedJob || undefined,
      });
      setMessage({ type: 'success', text: `${candidate.name} saved successfully` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save candidate' });
    }
  };

  const updateCandidateStatus = async (id: string, status: string) => {
    try {
      await apiClient.put(`/sourcing/candidates/${id}/status`, { status });
      fetchSavedCandidates();
    } catch { /* ignore */ }
  };

  const exportCandidates = async () => {
    try {
      const res = await apiClient.get('/sourcing/candidates/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'sourced-candidates.csv';
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch { setMessage({ type: 'error', text: 'Export failed' }); }
  };

  const connectIntegration = async (platform: string) => {
    try {
      const res = await apiClient.post(`/sourcing/oauth/${platform}/connect`);
      const authUrl = res.data?.data?.authUrl;
      if (authUrl) {
        window.open(authUrl, '_blank', 'width=600,height=700');
        setMessage({ type: 'success', text: `${platform} authorization window opened. Complete the login to connect.` });
        setTimeout(fetchIntegrations, 5000);
      } else {
        // Demo mode — connected directly without OAuth
        setMessage({ type: 'success', text: res.data?.message || `${platform} connected` });
        fetchIntegrations();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || `Failed to connect ${platform}` });
    }
  };

  const disconnectIntegration = async (platform: string) => {
    try {
      await apiClient.delete(`/sourcing/integrations/${platform}`);
      fetchIntegrations();
    } catch { /* ignore */ }
  };

  // ── Access guard ────────────────────────────────────────────
  if (user?.role !== 'employer' && user?.role !== 'admin' && user?.role !== 'hr') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">Only HR, Admin, or Employer roles can access sourcing.</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Candidate Sourcing</h1>
          <p className="mt-1 text-gray-600">Search LinkedIn, Naukri &amp; GitHub with AI-powered matching</p>
        </div>
        <button onClick={exportCandidates}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
          Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {(['search', 'saved', 'integrations', 'stats'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              {tab === 'stats' ? 'Analytics' : tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Toast */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          <div className="flex justify-between">
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="text-lg leading-none">&times;</button>
          </div>
        </div>
      )}

      {/* ─── TAB: Search ────────────────────────────────────── */}
      {activeTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters panel */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-6 sticky top-6 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">Search Criteria</h2>

              {/* Sources */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sources</label>
                <div className="space-y-2">
                  {[
                    { key: 'linkedin', label: 'LinkedIn', icon: 'in', color: 'text-blue-600' },
                    { key: 'naukri', label: 'Naukri', icon: 'N', color: 'text-purple-600' },
                    { key: 'github', label: 'GitHub', icon: '⌘', color: 'text-gray-800' },
                  ].map(({ key, label, icon, color }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={(sources as any)[key]}
                        onChange={(e) => setSources({ ...sources, [key]: e.target.checked })}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                      <span className={`font-semibold ${color}`}>{icon}</span>
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Job selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Match to Job (optional)</label>
                <select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Custom Search</option>
                  {jobs.map((j) => <option key={j._id} value={j._id}>{j.title}</option>)}
                </select>
              </div>

              {!selectedJob && (
                <>
                  {/* Skills */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Skills</label>
                    <div className="flex gap-2 mb-2">
                      <input type="text" value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="Add skill" />
                      <button onClick={addSkill} className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">+</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {criteria.skills.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs flex items-center gap-1">
                          {s}
                          <button onClick={() => setCriteria({ ...criteria, skills: criteria.skills.filter((x) => x !== s) })} className="hover:text-indigo-900">&times;</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input type="text" value={criteria.location}
                      onChange={(e) => setCriteria({ ...criteria, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Bangalore" />
                  </div>

                  {/* Experience */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" min="0" value={criteria.experienceMin}
                        onChange={(e) => setCriteria({ ...criteria, experienceMin: parseInt(e.target.value) || 0 })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Min" />
                      <input type="number" min="0" value={criteria.experienceMax}
                        onChange={(e) => setCriteria({ ...criteria, experienceMax: parseInt(e.target.value) || 10 })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Max" />
                    </div>
                  </div>

                  {/* Max results */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Results</label>
                    <input type="number" min="1" max="100" value={criteria.maxResults}
                      onChange={(e) => setCriteria({ ...criteria, maxResults: parseInt(e.target.value) || 25 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </>
              )}

              <button onClick={handleSearch} disabled={loading}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Searching...
                  </span>
                ) : 'Search Candidates'}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="bg-white shadow rounded-lg p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto" />
                <p className="mt-4 text-gray-600">AI is matching candidates across platforms...</p>
              </div>
            ) : candidates.length > 0 ? (
              <>
                <div className="bg-white shadow rounded-lg p-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">{candidates.length} candidate{candidates.length !== 1 ? 's' : ''} found</p>
                </div>

                {candidates.map((c, idx) => (
                  <div key={idx} className="bg-white shadow rounded-lg hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt={c.name} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                            {c.name.charAt(0)}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 truncate">{c.name}</h3>
                              <p className="text-sm text-gray-600">{c.currentPosition}{c.currentCompany ? ` at ${c.currentCompany}` : ''}</p>
                            </div>
                            {c.matchScore != null && (
                              <div className="text-center shrink-0">
                                <div className={`text-2xl font-bold ${c.matchScore >= 80 ? 'text-green-600' : c.matchScore >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                                  {c.matchScore}%
                                </div>
                                <div className="text-xs text-gray-500">AI Match</div>
                              </div>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                            <PlatformBadge platform={c.source} />
                            {c.location && <span>📍 {c.location}</span>}
                            {c.experience != null && <span>{c.experience}y exp</span>}
                            {c.githubData && (
                              <span className="text-gray-500">
                                ⭐ {c.githubData.repos} repos · {c.githubData.followers} followers
                              </span>
                            )}
                          </div>

                          {c.skills.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {c.skills.slice(0, 8).map((s) => (
                                <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">{s}</span>
                              ))}
                              {c.skills.length > 8 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">+{c.skills.length - 8}</span>
                              )}
                            </div>
                          )}

                          {/* Expandable match details */}
                          {c.matchDetails && (
                            <button onClick={() => setExpandedCard(expandedCard === idx ? null : idx)}
                              className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                              {expandedCard === idx ? '▾ Hide AI Analysis' : '▸ View AI Analysis'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded AI details */}
                      {expandedCard === idx && c.matchDetails && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Score Breakdown</h4>
                              <ScoreBar label="Skills" score={c.matchDetails.skillScore} color="bg-blue-500" />
                              <ScoreBar label="Experience" score={c.matchDetails.experienceScore} color="bg-green-500" />
                              <ScoreBar label="Location" score={c.matchDetails.locationScore} color="bg-yellow-500" />
                              <ScoreBar label="Semantic" score={c.matchDetails.semanticScore} color="bg-purple-500" />
                              <ScoreBar label="Recency" score={c.matchDetails.recencyScore} color="bg-pink-500" />
                              <div className="pt-2 text-xs text-gray-500">
                                Confidence: <span className="font-semibold">{c.matchDetails.confidenceScore}%</span>
                              </div>
                            </div>
                            <div>
                              {c.matchDetails.strengths.length > 0 && (
                                <div className="mb-3">
                                  <h4 className="text-sm font-semibold text-green-700 mb-1">Strengths</h4>
                                  <ul className="text-xs text-gray-600 space-y-0.5">
                                    {c.matchDetails.strengths.map((s, i) => <li key={i}>✓ {s}</li>)}
                                  </ul>
                                </div>
                              )}
                              {c.matchDetails.missingSkills.length > 0 && (
                                <div className="mb-3">
                                  <h4 className="text-sm font-semibold text-red-700 mb-1">Missing Skills</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {c.matchDetails.missingSkills.map((s) => (
                                      <span key={s} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs">{s}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {c.matchDetails.recommendation && (
                                <div className="p-2 bg-indigo-50 rounded text-xs text-indigo-800">
                                  <strong>Recommendation:</strong> {c.matchDetails.recommendation}
                                </div>
                              )}
                            </div>
                          </div>

                          {c.githubData && c.githubData.topLanguages?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <h4 className="text-sm font-semibold text-gray-700 mb-1">GitHub Tech Stack</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {c.githubData.topLanguages.map((l) => (
                                  <span key={l} className="px-2 py-0.5 bg-gray-800 text-white rounded text-xs">{l}</span>
                                ))}
                              </div>
                              <p className="mt-1 text-xs text-gray-500">
                                Contribution Score: {c.githubData.contributionScore} · Repos: {c.githubData.repos}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => saveCandidate(c, idx)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                          Save
                        </button>
                        {c.profileUrl && (
                          <a href={c.profileUrl} target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
                            View Profile ↗
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
                            Email
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="bg-white shadow rounded-lg p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Source</h3>
                <p className="text-gray-500 text-sm">Configure your search criteria and click Search to find candidates across LinkedIn, Naukri, and GitHub</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: Saved Candidates ──────────────────────────── */}
      {activeTab === 'saved' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Saved Candidates</h2>
            <select value={savedFilter} onChange={(e) => setSavedFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">All Statuses</option>
              {['sourced', 'shortlisted', 'contacted', 'responded', 'in_pipeline', 'rejected', 'saved'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {savedLoading ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600 mx-auto" />
            </div>
          ) : savedCandidates.length > 0 ? (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {savedCandidates.map((c) => (
                    <tr key={c._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{c.name}</div>
                        <div className="text-sm text-gray-500">{c.currentPosition}{c.currentCompany ? ` · ${c.currentCompany}` : ''}</div>
                      </td>
                      <td className="px-6 py-4"><PlatformBadge platform={c.source} /></td>
                      <td className="px-6 py-4">
                        {c.matchScore != null && (
                          <span className={`font-semibold ${c.matchScore >= 80 ? 'text-green-600' : c.matchScore >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {c.matchScore}%
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={c.status || 'sourced'} /></td>
                      <td className="px-6 py-4">
                        <select
                          defaultValue=""
                          onChange={(e) => { if (e.target.value && c._id) { updateCandidateStatus(c._id, e.target.value); e.target.value = ''; } }}
                          className="px-2 py-1 border border-gray-300 rounded text-xs">
                          <option value="" disabled>Move to...</option>
                          {['shortlisted', 'contacted', 'responded', 'in_pipeline', 'rejected'].map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500">
              No saved candidates yet. Search and save candidates to track them here.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Integrations ──────────────────────────────── */}
      {activeTab === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { platform: 'linkedin', name: 'LinkedIn', desc: 'Professional network — OAuth2 integration', color: 'border-blue-500', bg: 'bg-blue-50', icon: 'in', iconColor: 'text-blue-700' },
            { platform: 'naukri', name: 'Naukri', desc: 'India job portal — API key integration', color: 'border-purple-500', bg: 'bg-purple-50', icon: 'N', iconColor: 'text-purple-700' },
            { platform: 'github', name: 'GitHub', desc: 'Developer profiles — OAuth2 integration', color: 'border-gray-700', bg: 'bg-gray-100', icon: '⌘', iconColor: 'text-gray-800' },
          ].map(({ platform, name, desc, color, bg, icon, iconColor }) => {
            const int = integrations.find((i) => i.platform === platform);
            const connected = int?.status === 'connected';
            return (
              <div key={platform} className={`bg-white shadow rounded-lg border-t-4 ${color} p-6`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center text-xl font-bold ${iconColor}`}>{icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{name}</h3>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
                <div className="mb-4">
                  {connected ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                      <span className="w-2 h-2 bg-green-500 rounded-full" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                      <span className="w-2 h-2 bg-gray-400 rounded-full" /> Disconnected
                    </span>
                  )}
                  {int?.expiresAt && (
                    <span className="ml-2 text-xs text-gray-400">Expires {new Date(int.expiresAt).toLocaleDateString()}</span>
                  )}
                </div>
                {connected ? (
                  <button onClick={() => disconnectIntegration(platform)}
                    className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium">
                    Disconnect
                  </button>
                ) : (
                  <button onClick={() => connectIntegration(platform)} disabled={intLoading}
                    className={`w-full px-4 py-2 text-white rounded-lg text-sm font-medium ${
                      platform === 'linkedin' ? 'bg-blue-600 hover:bg-blue-700'
                        : platform === 'github' ? 'bg-gray-800 hover:bg-gray-900'
                        : 'bg-purple-600 hover:bg-purple-700'
                    } disabled:opacity-50`}>
                    Connect {name}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── TAB: Analytics ─────────────────────────────────── */}
      {activeTab === 'stats' && (
        <div>
          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white shadow rounded-lg p-6">
                <div className="text-sm text-gray-500">Total Sourced</div>
                <div className="text-3xl font-bold text-indigo-600 mt-1">{stats.totalSourced}</div>
              </div>
              <div className="bg-white shadow rounded-lg p-6">
                <div className="text-sm text-gray-500">Avg Match Score</div>
                <div className="text-3xl font-bold text-green-600 mt-1">{stats.avgMatchScore}%</div>
              </div>
              <div className="bg-white shadow rounded-lg p-6">
                <div className="text-sm text-gray-500">Recent Searches</div>
                <div className="text-3xl font-bold text-blue-600 mt-1">{stats.recentSearches}</div>
              </div>
              <div className="bg-white shadow rounded-lg p-6">
                <div className="text-sm text-gray-500">Platforms Used</div>
                <div className="text-3xl font-bold text-purple-600 mt-1">{Object.keys(stats.byPlatform).length}</div>
              </div>

              {/* By Platform */}
              {Object.keys(stats.byPlatform).length > 0 && (
                <div className="bg-white shadow rounded-lg p-6 md:col-span-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">By Platform</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.byPlatform).map(([platform, count]) => (
                      <div key={platform} className="flex items-center gap-3">
                        <PlatformBadge platform={platform} />
                        <div className="flex-1 bg-gray-200 rounded-full h-3">
                          <div className="h-3 rounded-full bg-indigo-500" style={{ width: `${Math.min((count as number / stats.totalSourced) * 100, 100)}%` }} />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By Status */}
              {Object.keys(stats.byStatus).length > 0 && (
                <div className="bg-white shadow rounded-lg p-6 md:col-span-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Pipeline Status</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.byStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <StatusBadge status={status} />
                        <span className="text-sm font-medium text-gray-700">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500">
              No sourcing data yet. Start searching to see analytics.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
