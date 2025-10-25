/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../services/api';

export default function CompleteRegistration() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [step, setStep] = useState<'verify' | 'register' | 'complete'>('verify');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    phone: '',
    enable2FA: true,
  });
  const [mfaData, setMfaData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setError('Invalid invitation link');
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      setLoading(true);
      const response = await apiClient.post('/hr/verify-invitation', { token });
      // apiClient already unwraps to { success, data, message }
      setUserInfo(response.data.user);
      setStep('register');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Invalid or expired invitation link');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Password strength validation
    const hasUpperCase = /[A-Z]/.test(formData.password);
    const hasLowerCase = /[a-z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
      setError('Password must contain uppercase, lowercase, number, and special character');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post('/hr/complete-registration', {
        token,
        password: formData.password,
        phone: formData.phone,
        enable2FA: formData.enable2FA,
      });

      // Store tokens - apiClient already unwraps to { success, data, message }
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);

      // If 2FA was enabled, show QR code
      if (response.data.mfa) {
        setMfaData(response.data.mfa);
      }

      setStep('complete');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to complete registration');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    const password = formData.password;
    if (password.length === 0) return null;
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

    if (strength <= 2) return { label: 'Weak', color: 'bg-red-500', width: '33%' };
    if (strength <= 4) return { label: 'Medium', color: 'bg-yellow-500', width: '66%' };
    return { label: 'Strong', color: 'bg-green-500', width: '100%' };
  };

  if (loading && step === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-2xl w-full bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Registration Complete!</h2>
            <p className="text-gray-600 mb-6">
              Your account has been successfully created and activated.
            </p>

            {mfaData && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🔒 Two-Factor Authentication Setup
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <div className="flex justify-center mb-4">
                  <img src={mfaData.qrCode} alt="2FA QR Code" className="border p-2 bg-white" />
                </div>
                <p className="text-xs text-gray-500 mb-2">Or enter this code manually:</p>
                <code className="bg-gray-100 px-4 py-2 rounded text-sm font-mono">
                  {mfaData.secret}
                </code>
                <div className="mt-4 text-left text-sm text-gray-600">
                  <p className="font-semibold mb-2">Next steps:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Save the QR code or secret key in a secure place</li>
                    <li>You'll need the authenticator code every time you log in</li>
                    <li>Keep backup codes in case you lose access to your device</li>
                  </ol>
                </div>
              </div>
            )}

            <button
              onClick={() => navigate('/dashboard')}
              className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 text-lg font-semibold"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const strength = getPasswordStrength();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Complete Your Registration</h2>
          <p className="text-gray-600 mt-2">
            Welcome, {userInfo?.firstName}! Please set up your account.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700">
            <strong>Email:</strong> {userInfo?.email}
            <br />
            <strong>Role:</strong> <span className="capitalize">{userInfo?.role}</span>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Minimum 8 characters"
            />
            {strength && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">Password strength:</span>
                  <span className={`font-semibold ${strength.color.replace('bg-', 'text-')}`}>
                    {strength.label}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${strength.color}`}
                    style={{ width: strength.width }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password *
            </label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="+1 234 567 8900"
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={formData.enable2FA}
                onChange={(e) => setFormData({ ...formData, enable2FA: e.target.checked })}
                className="mt-1 mr-3"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  Enable Two-Factor Authentication (Recommended)
                </span>
                <p className="text-xs text-gray-600 mt-1">
                  Add an extra layer of security to your account. You'll need an authenticator app.
                </p>
              </div>
            </label>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600">
              <strong>Password requirements:</strong>
            </p>
            <ul className="text-xs text-gray-600 mt-2 space-y-1">
              <li className={formData.password.length >= 8 ? 'text-green-600' : ''}>
                ✓ At least 8 characters
              </li>
              <li className={/[A-Z]/.test(formData.password) ? 'text-green-600' : ''}>
                ✓ One uppercase letter
              </li>
              <li className={/[a-z]/.test(formData.password) ? 'text-green-600' : ''}>
                ✓ One lowercase letter
              </li>
              <li className={/[0-9]/.test(formData.password) ? 'text-green-600' : ''}>
                ✓ One number
              </li>
              <li className={/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? 'text-green-600' : ''}>
                ✓ One special character
              </li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
