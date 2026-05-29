import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';

export default function SSOCallback() {
  const navigate    = useNavigate();
  const { setUser } = useAuthStore();

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const token   = params.get('token');
    const refresh = params.get('refresh');
    const error   = params.get('error');

    if (error || !token) {
      const messages: Record<string, string> = {
        sso_denied:              'SSO login was denied by the identity provider.',
        sso_state_expired:       'SSO session expired. Please try again.',
        sso_domain_not_allowed:  'Your email domain is not authorized for SSO.',
        sso_no_email:            'Could not retrieve your email from the identity provider.',
        sso_account_inactive:    'Your account is inactive. Contact your admin.',
        sso_failed:              'SSO login failed. Please try again.',
        sso_not_configured:      'SSO is not configured for this company.',
      };
      const msg = messages[error ?? ''] ?? 'SSO login failed.';
      navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true });
      return;
    }

    // Store tokens
    const store = useAuthStore.getState();
    localStorage.setItem('token', token);
    if (refresh) localStorage.setItem('refreshToken', refresh);
    store.setToken(token);

    apiClient.get('/auth/me')
      .then((res) => {
        const user = (res.data as any)?.data ?? (res.data as any)?.user;
        if (user) setUser(user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        navigate('/login?error=sso_session_error', { replace: true });
      });
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-neutral-500">Completing SSO login…</p>
      </div>
    </div>
  );
}
