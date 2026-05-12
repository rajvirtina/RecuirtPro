import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/api';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

interface InvitationData {
  email: string;
  companyId: {
    name: string;
    logo?: string;
  };
  status: string;
  expiresAt: string;
}

interface CompanyLookup {
  name: string;
  logo?: string;
  slug: string;
}

export default function Register() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [companyLookup, setCompanyLookup] = useState<CompanyLookup | null>(null);
  const [companyLookupError, setCompanyLookupError] = useState('');
  const [lookingUpCompany, setLookingUpCompany] = useState(false);
  const companyLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'candidate',
    invitationToken: invitationToken || '',
    companySlug: '',
  });

  useEffect(() => {
    if (invitationToken) {
      verifyInvitationToken();
    }
  }, [invitationToken]);

  const verifyInvitationToken = async () => {
    try {
      setVerifyingToken(true);
      setError('');
      const response = await apiClient.get(`/invitations/verify/${invitationToken}`);
      const invitation = response.data.data;
      setInvitationData(invitation);
      setFormData(prev => ({ ...prev, email: invitation.email }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired invitation');
    } finally {
      setVerifyingToken(false);
    }
  };

  const lookupCompany = async (slug: string) => {
    if (!slug.trim()) {
      setCompanyLookup(null);
      setCompanyLookupError('');
      return;
    }
    try {
      setLookingUpCompany(true);
      setCompanyLookupError('');
      setCompanyLookup(null);
      const response = await apiClient.get(`/jobs/company/${slug.trim().toLowerCase()}/info`);
      const company = response.data?.data;
      setCompanyLookup({ name: company.name, logo: company.logo, slug: company.slug });
    } catch (err: any) {
      setCompanyLookupError('No company found with this code. Please check with your recruiter.');
      setCompanyLookup(null);
    } finally {
      setLookingUpCompany(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');

    if (name === 'companySlug') {
      setCompanyLookup(null);
      setCompanyLookupError('');
      if (companyLookupTimer.current) clearTimeout(companyLookupTimer.current);
      companyLookupTimer.current = setTimeout(() => lookupCompany(value), 600);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    const hasUppercase = /[A-Z]/.test(formData.password);
    const hasLowercase = /[a-z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
      return;
    }

    // Require company code for candidates without invitation
    if (!invitationToken && formData.role === 'candidate') {
      if (!formData.companySlug.trim()) {
        setError('Company code is required. Please enter the code provided by your recruiter.');
        return;
      }
      if (companyLookupError || !companyLookup) {
        setError('Please enter a valid company code before continuing.');
        return;
      }
    }

    setLoading(true);

    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isCandidate = formData.role === 'candidate';
  const showCompanyField = !invitationToken && isCandidate;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-4xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {invitationToken ? 'Complete your registration' : 'Join RecuirtPro and streamline your recruitment process'}
          </p>
        </div>

        {/* Invitation Info Banner */}
        {verifyingToken && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-700 text-center">Verifying invitation...</p>
          </div>
        )}

        {invitationData && !verifyingToken && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium text-green-800">Invitation Valid</p>
                <p className="text-sm text-green-700 mt-1">
                  You've been invited to join <strong>{invitationData.companyId.name}</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {error && invitationToken && !invitationData && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium text-red-800">Invalid Invitation</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <Link to="/register" className="text-sm text-red-600 underline mt-2 inline-block">
                  Register without invitation
                </Link>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-lg" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                value={formData.firstName}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="John"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              disabled={!!invitationData}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="john.doe@example.com"
            />
            {invitationData && (
              <p className="mt-1 text-xs text-gray-500">Email from invitation (cannot be changed)</p>
            )}
          </div>

          {!invitationToken && (
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                I am a
              </label>
              <select
                id="role"
                name="role"
                required
                value={formData.role}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="candidate">Employee / Job Seeker</option>
                <option value="employer">Employer / Company</option>
              </select>
            </div>
          )}

          {/* Company Code field — only for candidates without invitation */}
          {showCompanyField && (
            <div>
              <label htmlFor="companySlug" className="block text-sm font-medium text-gray-700">
                Company Code <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="companySlug"
                  name="companySlug"
                  type="text"
                  required={showCompanyField}
                  value={formData.companySlug}
                  onChange={handleChange}
                  className={`appearance-none relative block w-full px-3 py-2 border placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 sm:text-sm ${
                    companyLookupError
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : companyLookup
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                      : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                  placeholder="e.g. ambiquest or techiworld"
                />
                {lookingUpCompany && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
                {!lookingUpCompany && companyLookup && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  </div>
                )}
                {!lookingUpCompany && companyLookupError && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                  </div>
                )}
              </div>

              {/* Company found confirmation */}
              {companyLookup && !lookingUpCompany && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  {companyLookup.logo ? (
                    <img src={companyLookup.logo} alt={companyLookup.name} className="w-5 h-5 rounded object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{companyLookup.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span>Registering under <strong>{companyLookup.name}</strong></span>
                </div>
              )}

              {/* Company not found */}
              {companyLookupError && !lookingUpCompany && (
                <p className="mt-1 text-xs text-red-600">{companyLookupError}</p>
              )}

              <p className="mt-1 text-xs text-gray-500">
                Enter the company code provided by your recruiter or HR team.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Create a strong password"
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be 8+ characters with uppercase, lowercase, number, and special character (!@#$%^&*)
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Confirm your password"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
