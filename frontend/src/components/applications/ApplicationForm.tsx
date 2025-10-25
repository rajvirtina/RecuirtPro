import React, { useState } from 'react';
import { apiClient } from '../../services/api';
import { 
  DocumentArrowUpIcon, 
  XMarkIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/solid';

interface ApplicationFormProps {
  jobId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ApplicationForm({ jobId, onSuccess, onCancel }: ApplicationFormProps) {
  const [formData, setFormData] = useState({
    coverLetter: '',
    expectedSalary: '',
  });
  const [resume, setResume] = useState<File | null>(null);
  const [resumePreview, setResumePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a PDF, DOC, or DOCX file.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    setResume(file);
    setResumePreview(file.name);
    setError('');
  };

  const removeResume = () => {
    setResume(null);
    setResumePreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setUploading(true);
    setUploadProgress(0);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('jobId', jobId);
      
      if (formData.coverLetter) {
        formDataToSend.append('coverLetter', formData.coverLetter);
      }
      
      if (formData.expectedSalary) {
        formDataToSend.append('expectedSalary', formData.expectedSalary);
      }
      
      if (resume) {
        formDataToSend.append('resume', resume);
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await apiClient.post('/applications', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setSuccess('Application submitted successfully!');
      
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit application');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <h2 className="text-xl font-bold text-gray-900">Submit Application</h2>
        <p className="text-sm text-gray-600 mt-1">Fill in the details below to apply for this position</p>
      </div>

      <div className="px-6 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start">
            <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-green-700">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Resume Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Resume / CV <span className="text-red-500">*</span>
            </label>
            
            {!resume ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition cursor-pointer">
                <input
                  type="file"
                  id="resume"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  required
                />
                <label htmlFor="resume" className="cursor-pointer">
                  <DocumentArrowUpIcon className="h-10 w-10 text-indigo-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, DOC or DOCX (max. 5MB)
                  </p>
                </label>
              </div>
            ) : (
              <div className="border border-green-300 bg-green-50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center min-w-0 flex-1">
                  <DocumentArrowUpIcon className="h-6 w-6 text-green-600 mr-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{resumePreview}</p>
                    <p className="text-xs text-gray-600">
                      {(resume.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeResume}
                  className="ml-3 text-red-500 hover:text-red-700 flex-shrink-0"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Cover Letter */}
          <div>
            <label htmlFor="coverLetter" className="block text-sm font-semibold text-gray-700 mb-2">
              Cover Letter <span className="text-gray-400 text-xs font-normal">(Optional)</span>
            </label>
            <textarea
              id="coverLetter"
              rows={5}
              value={formData.coverLetter}
              onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
              placeholder="Tell us why you're a great fit for this role..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Expected Salary */}
          <div>
            <label htmlFor="expectedSalary" className="block text-sm font-semibold text-gray-700 mb-2">
              Expected Salary <span className="text-gray-400 text-xs font-normal">(Annual, Optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
              <input
                type="number"
                id="expectedSalary"
                value={formData.expectedSalary}
                onChange={(e) => setFormData({ ...formData, expectedSalary: e.target.value })}
                placeholder="50000"
                className="w-full pl-8 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2 bg-indigo-50 p-3 rounded-lg">
              <div className="flex justify-between text-sm text-indigo-700 font-medium">
                <span>Uploading application...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={uploading || !resume}
              className="flex-1 px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {uploading ? 'Submitting...' : 'Submit Application'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={uploading}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition disabled:opacity-50 text-sm"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center pt-1">
            By submitting this application, you agree to our terms and conditions
          </p>
        </form>
      </div>
    </div>
  );
}
