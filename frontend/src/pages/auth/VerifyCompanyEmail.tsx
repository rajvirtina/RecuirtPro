import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/Button';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

export default function VerifyCompanyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    axios
      .post(`${API_URL}/admin/companies/verify-email`, { token })
      .then((res) => {
        setStatus('success');
        setMessage(res.data?.message || 'Company email verified successfully!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(
          err.response?.data?.message || 'Verification failed. The token may be invalid or expired.'
        );
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-neutral-700">Verifying your email...</h2>
            <p className="text-neutral-500 mt-2">Please wait while we verify your company email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="h-12 w-12 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-success-700">Email Verified!</h2>
            <p className="text-neutral-600 mt-2">{message}</p>
            <div className="mt-6">
              <Button variant="primary" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="h-12 w-12 rounded-full bg-error-50 flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-error-700">Verification Failed</h2>
            <p className="text-neutral-600 mt-2">{message}</p>
            <div className="mt-6">
              <Button variant="secondary" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
