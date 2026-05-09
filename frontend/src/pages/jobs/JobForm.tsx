import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';

interface JobFormData {
  title: string;
  description: string;
  location: string;
  jobType: string;
  workMode: string;
  experienceMin: number;
  experienceMax: number;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  skills: string[];
  requirements: string[];
}

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [skillInput, setSkillInput] = useState('');
  const [requirementInput, setRequirementInput] = useState('');

  const [formData, setFormData] = useState<JobFormData>({
    title: '',
    description: '',
    location: '',
    jobType: 'full_time',
    workMode: 'onsite',
    experienceMin: 0,
    experienceMax: 5,
    salaryMin: 0,
    salaryMax: 0,
    currency: 'INR',
    skills: [],
    requirements: [],
  });

  useEffect(() => {
    if (isEdit) {
      fetchJobDetails();
    }
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/jobs/${id}`);
      const job = response.data as any;
      setFormData({
        title: job.title || '',
        description: job.description || '',
        location: job.location || '',
        jobType: job.jobType || 'full_time',
        workMode: job.workMode || 'onsite',
        experienceMin: job.experienceMin || 0,
        experienceMax: job.experienceMax || 5,
        salaryMin: job.salaryMin || 0,
        salaryMax: job.salaryMax || 0,
        currency: job.currency || 'INR',
        skills: job.skills || [],
        requirements: job.requirements || [],
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to load job details',
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!formData.title.trim()) {
      errors.push('Job title is required');
    }
    
    if (!formData.description.trim()) {
      errors.push('Job description is required');
    }
    
    if (!formData.location.trim()) {
      errors.push('Location is required');
    }
    
    if (formData.skills.length === 0) {
      errors.push('At least one skill is required');
    }
    
    if (formData.experienceMin < 0) {
      errors.push('Minimum experience cannot be negative');
    }
    
    if (formData.experienceMax < formData.experienceMin) {
      errors.push('Maximum experience must be greater than or equal to minimum experience');
    }
    
    if (formData.salaryMin > 0 && formData.salaryMax > 0 && formData.salaryMax < formData.salaryMin) {
      errors.push('Maximum salary must be greater than or equal to minimum salary');
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setMessage({ 
        type: 'error', 
        text: validationErrors.join(', ')
      });
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      if (isEdit) {
        await apiClient.put(`/jobs/${id}`, formData);
        setMessage({ type: 'success', text: 'Job updated successfully!' });
      } else {
        await apiClient.post('/jobs', formData);
        setMessage({ type: 'success', text: 'Job posted successfully!' });
      }

      setTimeout(() => navigate('/jobs'), 1500);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.errors?.join(', ') ||
                          `Failed to ${isEdit ? 'update' : 'create'} job`;
      setMessage({
        type: 'error',
        text: errorMessage,
      });
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter((s) => s !== skill) });
  };

  const addRequirement = () => {
    if (requirementInput.trim()) {
      setFormData({ ...formData, requirements: [...formData.requirements, requirementInput.trim()] });
      setRequirementInput('');
    }
  };

  const removeRequirement = (index: number) => {
    setFormData({
      ...formData,
      requirements: formData.requirements.filter((_, i) => i !== index),
    });
  };

  if (user?.role !== 'employer' && user?.role !== 'admin' && user?.role !== 'hr') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">Only employers and HR can post jobs.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate('/jobs')}
        className="mb-6 text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Jobs
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEdit ? 'Edit Job' : 'Post New Job'}
      </h1>

      {message.text && (
        <div
          className={`mb-6 p-4 rounded-lg border-2 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border-green-200' 
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {message.type === 'success' ? (
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="flex-1">
              <p className="font-semibold mb-1">
                {message.type === 'success' ? 'Success!' : 'Please fix the following errors:'}
              </p>
              {message.type === 'error' && message.text.includes(',') ? (
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {message.text.split(',').map((error, index) => (
                    <li key={index}>{error.trim()}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">{message.text}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        {/* Job Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Job Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="e.g., Senior Full Stack Developer"
            required
          />
        </div>

        {/* Job Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Job Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Describe the role, responsibilities, and what you're looking for..."
            required
          />
        </div>

        {/* Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g., Bangalore, India"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work Mode</label>
            <select
              value={formData.workMode}
              onChange={(e) => setFormData({ ...formData, workMode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="onsite">On-site</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
        </div>

        {/* Job Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
          <select
            value={formData.jobType}
            onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
            <option value="temporary">Temporary</option>
          </select>
        </div>

        {/* Experience Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Experience (years)
            </label>
            <input
              type="number"
              min="0"
              value={formData.experienceMin || ''}
              onChange={(e) => setFormData({ ...formData, experienceMin: e.target.value === '' ? 0 : parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Experience (years)
            </label>
            <input
              type="number"
              min="0"
              value={formData.experienceMax || ''}
              onChange={(e) => setFormData({ ...formData, experienceMax: e.target.value === '' ? 0 : parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Salary Range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Min Salary</label>
            <input
              type="number"
              min="0"
              value={formData.salaryMin || ''}
              onChange={(e) => setFormData({ ...formData, salaryMin: e.target.value === '' ? 0 : parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max Salary</label>
            <input
              type="number"
              min="0"
              value={formData.salaryMax || ''}
              onChange={(e) => setFormData({ ...formData, salaryMax: e.target.value === '' ? 0 : parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        {/* Required Skills */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Required Skills <span className="text-red-500">*</span>
            <span className="text-xs text-gray-500 ml-2">(At least one skill required)</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g., React, Node.js, MongoDB (Press Enter to add)"
            />
            <button
              type="button"
              onClick={addSkill}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Add
            </button>
          </div>
          {formData.skills.length === 0 && (
            <p className="text-sm text-amber-600 mb-2">⚠️ Please add at least one required skill</p>
          )}
          <div className="flex flex-wrap gap-2">
            {formData.skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm flex items-center gap-1"
              >
                {skill}
                <button type="button" onClick={() => removeSkill(skill)} className="hover:text-indigo-900">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Requirements</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={requirementInput}
              onChange={(e) => setRequirementInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter a requirement and press Enter"
            />
            <button
              type="button"
              onClick={addRequirement}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Add
            </button>
          </div>
          <ul className="space-y-2">
            {formData.requirements.map((req, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="flex-1">• {req}</span>
                <button
                  type="button"
                  onClick={() => removeRequirement(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Job' : 'Post Job'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
