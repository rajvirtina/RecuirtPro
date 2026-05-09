import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Briefcase,
  Building2,
  MapPin,
  X
} from 'lucide-react';

interface Job {
  _id: string;
  title: string;
  companyId: {
    _id: string;
    name: string;
    logo?: string;
  };
  location: string;
  workMode: string;
  jobType: string;
  experienceMin: number;
  experienceMax: number;
}

export default function ApplyJob() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationInfo, setApplicationInfo] = useState<any>(null);

  const [formData, setFormData] = useState({
    coverLetter: '',
    expectedSalary: '',
    noticePeriod: '',
    resumeFile: null as File | null,
  });

  useEffect(() => {
    fetchJob();
    checkApplicationStatus();
  }, [id]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get(`/jobs/${id}`);
      console.log('[ApplyJob] API Response:', response);
      // API returns { success: true, data: { job: ... } }
      const jobData = (response.data as any)?.job || response.data;
      console.log('[ApplyJob] Job Data:', jobData);
      
      if (!jobData) {
        setError('Job data not found in response');
        return;
      }
      
      setJob(jobData);
    } catch (error: any) {
      console.error('[ApplyJob] Error fetching job:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to load job details';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      const response = await apiClient.get(`/applications/check/${id}`);
      const statusData = response.data;
      console.log('[ApplyJob] Application Status:', statusData);
      
      if (statusData?.hasApplied) {
        setHasApplied(true);
        setApplicationInfo(statusData.application);
      }
    } catch (error: any) {
      // If error (e.g., not logged in or other issue), just log it
      console.error('[ApplyJob] Error checking application status:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError('Resume file size must be less than 5MB');
        return;
      }
      if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
        setError('Resume must be PDF or Word document');
        return;
      }
      setFormData({ ...formData, resumeFile: file });
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.resumeFile) {
      setError('Please upload your resume');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const submitData = new FormData();
      submitData.append('jobId', id!);
      submitData.append('coverLetter', formData.coverLetter);
      if (formData.expectedSalary) {
        submitData.append('expectedSalary', formData.expectedSalary);
      }
      if (formData.noticePeriod) {
        submitData.append('noticePeriod', formData.noticePeriod);
      }
      submitData.append('resume', formData.resumeFile);

      await apiClient.post('/applications', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/candidate/jobs');
      }, 2000);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Job Not Found</h2>
          <p className="text-gray-600 mb-6">The job you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate('/candidate/jobs')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your application for <strong>{job.title}</strong> at <strong>{job.companyId.name}</strong> has been submitted successfully.
          </p>
          <p className="text-sm text-gray-500">Redirecting you back to jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/candidate/jobs')}
            className="text-indigo-600 hover:text-indigo-700 font-medium mb-4 inline-flex items-center"
          >
            ← Back to Jobs
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Apply for Position</h1>
        </div>

        {/* Job Summary Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            {job.companyId.logo ? (
              <img
                src={job.companyId.logo}
                alt={job.companyId.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-white" />
              </div>
            )}
            
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{job.title}</h2>
              <p className="text-lg text-gray-700 mb-2">{job.companyId.name}</p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  {job.experienceMin}-{job.experienceMax} years
                </span>
                <span className="capitalize">{job.workMode}</span>
                <span className="capitalize">{job.jobType.replace('-', ' ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Application Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Application Details</h3>

          {/* Already Applied Notice */}
          {hasApplied && (
            <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900 text-lg mb-2">Already Applied</h4>
                  <p className="text-sm text-green-700 mb-3">
                    You have already submitted an application for this position.
                  </p>
                  {applicationInfo && (
                    <div className="text-sm text-green-600">
                      <p><strong>Application Status:</strong> <span className="capitalize">{applicationInfo.status}</span></p>
                      <p><strong>Applied On:</strong> {new Date(applicationInfo.appliedAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</p>
                    </div>
                  )}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => navigate('/applications')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      View My Applications
                    </button>
                    <button
                      onClick={() => navigate('/candidate/jobs')}
                      className="px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      Browse More Jobs
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Only show form if not already applied */}
          {!hasApplied && (
            <>
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-900">Error</h4>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resume / CV <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                {!formData.resumeFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600 mb-1">Click to upload resume</span>
                    <span className="text-xs text-gray-500">PDF or Word (Max 5MB)</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      required
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-indigo-600" />
                      <div>
                        <p className="font-medium text-gray-900">{formData.resumeFile.name}</p>
                        <p className="text-sm text-gray-600">
                          {(formData.resumeFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, resumeFile: null })}
                      className="p-1 hover:bg-indigo-100 rounded"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Cover Letter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Letter <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.coverLetter}
                onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Tell us why you're interested in this role and what makes you a great fit..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum 100 characters. Be specific about your skills and experience.
              </p>
            </div>

            {/* Expected Salary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Salary (Annual)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500">₹</span>
                <input
                  type="number"
                  value={formData.expectedSalary}
                  onChange={(e) => setFormData({ ...formData, expectedSalary: e.target.value })}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., 600000"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Optional - Enter amount in INR</p>
            </div>

            {/* Notice Period */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notice Period
              </label>
              <select
                value={formData.noticePeriod}
                onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select notice period</option>
                <option value="Immediate">Immediate</option>
                <option value="15 days">15 days</option>
                <option value="30 days">30 days</option>
                <option value="60 days">60 days</option>
                <option value="90 days">90 days</option>
              </select>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting || !formData.resumeFile || !formData.coverLetter}
                className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/candidate/jobs')}
                className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
          </>
          )}
        </div>

        {/* Privacy Notice */}
        {!hasApplied && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Privacy Notice:</strong> Your resume and application details will be shared with {job.companyId.name} for recruitment purposes only. We respect your privacy and comply with data protection regulations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
