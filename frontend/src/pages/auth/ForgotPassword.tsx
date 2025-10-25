/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/auth/forgot-password', { email });
      setSuccess(true);
      setEmail('');
    } catch (error: any) {
      if (error.response?.status === 429) {
        setError(error.response.data.message || 'Too many attempts. Please try again later.');
      } else {
        // Don't reveal if the email exists for security
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔑</div>
          <h2 className="text-3xl font-bold text-gray-900">Forgot Password?</h2>
          <p className="text-gray-600 mt-2">
            No worries! Enter your email and we'll send you reset instructions.
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <div className="text-green-500 text-4xl mb-3">✓</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Check Your Email
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              If an account exists with that email, we've sent password reset instructions.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
              <p className="text-xs text-yellow-800">
                <strong>⚠️ Important:</strong> The reset link will expire in 1 hour. If you don't see the email, check your spam folder.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800">
                  <strong>🔒 Security Info:</strong>
                </p>
                <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Reset links are valid for 1 hour only</li>
                  <li>Old reset links become invalid when you request a new one</li>
                  <li>Limited to 5 attempts per hour for security</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="text-center space-y-2">
                <Link
                  to="/login"
                  className="block text-sm text-indigo-600 hover:text-indigo-800"
                >
                  ← Back to Login
                </Link>
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-indigo-600 hover:text-indigo-800 font-medium">
                    Sign up
                  </Link>
                </p>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
