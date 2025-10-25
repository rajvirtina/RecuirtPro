/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';

interface CandidateProfile {
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
  resumeUrl?: string;
  imageUrl?: string;
  matchScore?: number;
}

export default function CandidateSourcing() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [sources, setSources] = useState({
    linkedin: true,
    naukri: true,
  });
  const [criteria, setCriteria] = useState({
    skills: [] as string[],
    location: '',
    experienceMin: 0,
    experienceMax: 10,
    maxResults: 25,
  });
  const [skillInput, setSkillInput] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await apiClient.get('/jobs?limit=100');
      const jobsData = response.data?.data || [];
      setJobs(jobsData);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const handleSearch = async () => {
    if (!sources.linkedin && !sources.naukri) {
      setMessage({ type: 'error', text: 'Please select at least one source' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    setCandidates([]);

    try {
      const selectedSources = [];
      if (sources.linkedin) selectedSources.push('linkedin');
      if (sources.naukri) selectedSources.push('naukri');

      let response;
      if (selectedJob) {
        // Search for specific job
        response = await apiClient.post(`/sourcing/jobs/${selectedJob}/candidates`, {
          sources: selectedSources,
          maxResults: criteria.maxResults,
        });
      } else {
        // General search with criteria
        response = await apiClient.post('/sourcing/search', {
          sources: selectedSources,
          criteria: {
            skills: criteria.skills,
            location: criteria.location || undefined,
            experienceMin: criteria.experienceMin,
            experienceMax: criteria.experienceMax,
            maxResults: criteria.maxResults,
          },
        });
      }

      const candidatesData = response.data?.data?.candidates || [];
      setCandidates(candidatesData);
      setMessage({
        type: 'success',
        text: `Found ${candidatesData.length} candidates from ${selectedSources.join(' & ')}`,
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to source candidates',
      });
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !criteria.skills.includes(skillInput.trim())) {
      setCriteria({ ...criteria, skills: [...criteria.skills, skillInput.trim()] });
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setCriteria({ ...criteria, skills: criteria.skills.filter((s) => s !== skill) });
  };

  if (user?.role !== 'employer' && user?.role !== 'admin' && user?.role !== 'hr') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">Only employers can access candidate sourcing.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Candidate Sourcing</h1>
        <p className="mt-2 text-gray-600">
          Find and connect with qualified candidates from LinkedIn and Naukri
        </p>
      </div>

      {message.text && (
        <div
          className={`mb-6 p-4 rounded-lg border-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Filters */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Criteria</h2>

            {/* Source Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sources</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={sources.linkedin}
                    onChange={(e) => setSources({ ...sources, linkedin: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">LinkedIn</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={sources.naukri}
                    onChange={(e) => setSources({ ...sources, naukri: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Naukri</span>
                </label>
              </div>
            </div>

            {/* Job Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search for Job (Optional)
              </label>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Custom Search</option>
                {jobs.map((job) => (
                  <option key={job._id} value={job._id}>
                    {job.title}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Select a job to auto-fill criteria
              </p>
            </div>

            {/* Manual Criteria (only show if no job selected) */}
            {!selectedJob && (
              <>
                {/* Skills */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="Add skill"
                    />
                    <button
                      type="button"
                      onClick={addSkill}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {criteria.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs flex items-center gap-1"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="hover:text-indigo-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={criteria.location}
                    onChange={(e) => setCriteria({ ...criteria, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="e.g., Bangalore"
                  />
                </div>

                {/* Experience Range */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Experience (years)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min="0"
                      value={criteria.experienceMin}
                      onChange={(e) =>
                        setCriteria({ ...criteria, experienceMin: parseInt(e.target.value) || 0 })
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="Min"
                    />
                    <input
                      type="number"
                      min="0"
                      value={criteria.experienceMax}
                      onChange={(e) =>
                        setCriteria({ ...criteria, experienceMax: parseInt(e.target.value) || 10 })
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="Max"
                    />
                  </div>
                </div>

                {/* Max Results */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Results
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={criteria.maxResults}
                    onChange={(e) =>
                      setCriteria({ ...criteria, maxResults: parseInt(e.target.value) || 25 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </>
            )}

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
            >
              {loading ? 'Searching...' : 'Search Candidates'}
            </button>
          </div>
        </div>

        {/* Candidates List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Searching for candidates...</p>
            </div>
          ) : candidates.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-white shadow rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  Showing {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
                </p>
              </div>

              {candidates.map((candidate, index) => (
                <div key={index} className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    {candidate.imageUrl && (
                      <img
                        src={candidate.imageUrl}
                        alt={candidate.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{candidate.name}</h3>
                          <p className="text-sm text-gray-600">
                            {candidate.currentPosition} at {candidate.currentCompany}
                          </p>
                        </div>
                        {candidate.matchScore !== undefined && (
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-indigo-600">
                                {candidate.matchScore}%
                              </div>
                              <div className="text-xs text-gray-500">Match</div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                        {candidate.location && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {candidate.location}
                          </span>
                        )}
                        {candidate.experience && (
                          <span>{candidate.experience} years exp.</span>
                        )}
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {candidate.source}
                        </span>
                      </div>

                      {candidate.summary && (
                        <p className="mt-3 text-sm text-gray-700">{candidate.summary}</p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {candidate.skills.slice(0, 6).map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs"
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 6 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                            +{candidate.skills.length - 6} more
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex gap-3">
                        {candidate.profileUrl && (
                          <a
                            href={candidate.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            View Profile →
                          </a>
                        )}
                        {candidate.email && (
                          <a
                            href={`mailto:${candidate.email}`}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Contact
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates yet</h3>
              <p className="text-gray-600">
                Click "Search Candidates" to find qualified candidates from LinkedIn and Naukri
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
