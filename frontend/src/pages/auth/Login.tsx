import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';

type UserType = 'employee' | 'employer';

export default function Login() {
  const navigate = useNavigate();
  const login    = useAuthStore((state) => state.login);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab]       = useState<UserType>('employee');
  const [formData, setFormData]         = useState({ email: '', password: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(formData.email, formData.password);
      const u = useAuthStore.getState().user;
      const candidateRoles = ['candidate'];
      const employerRoles  = ['employer', 'hr', 'admin', 'interviewer'];
      if (activeTab === 'employee' && u && !candidateRoles.includes(u.role)) {
        useAuthStore.getState().logout();
        setError('This account is not a candidate account.');
        return;
      }
      if (activeTab === 'employer' && u && !employerRoles.includes(u.role)) {
        useAuthStore.getState().logout();
        setError('This account is not an employer account.');
        return;
      }
      if (u?.role === 'admin' && !u?.companyId) navigate('/superadmin');
      else if (u?.role === 'admin')              navigate('/admin');
      else                                       navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-h1 text-neutral-900">Welcome back</h1>
        <p className="text-body text-neutral-500 mt-1">Sign in to your RecuirtPro account</p>
      </div>

      {/* Role toggle */}
      <div className="flex bg-neutral-100 p-1 rounded-md mb-6">
        {(['employee', 'employer'] as UserType[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setActiveTab(tab); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-sm transition-all capitalize ${
              activeTab === tab
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab === 'employee' ? 'Candidate' : 'Employer / HR'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-error-50 border border-error-100 rounded-md">
          <svg className="w-4 h-4 text-error-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-error-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label htmlFor="email" className="field-label">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder={activeTab === 'employee' ? 'you@example.com' : 'hr@company.com'}
            className="field-input"
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="field-label mb-0">Password</label>
            <Link to="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className="field-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 hover:text-neutral-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full mt-2"
        >
          {!loading && `Sign in as ${activeTab === 'employee' ? 'Candidate' : 'Employer'}`}
        </Button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-neutral-500">
        {activeTab === 'employee' ? (
          <>
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
              Create one free
            </Link>
          </>
        ) : (
          'Employer accounts are provisioned by your company admin.'
        )}
      </p>
    </div>
  );
}
