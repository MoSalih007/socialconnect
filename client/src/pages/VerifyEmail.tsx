import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const calledRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-firing in development.
    // Without this, the first call verifies the token (setting it to NULL in DB),
    // and the second call immediately fails because the token no longer exists.
    if (calledRef.current) return;
    calledRef.current = true;

    const token = searchParams.get('token');
    if (!token) { setStatus('error'); return; }
    fetch(`${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) { setStatus('success'); setTimeout(() => navigate('/login'), 3000); }
        else { setStatus('error'); }
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dark px-4 relative">
      <div className="fixed inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,255,209,0.15) 0%, transparent 60%)' }} />
      <div className="fixed inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative glass max-w-md w-full text-center p-10 shadow-card-glow">
        {status === 'loading' && (
          <div>
            <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Verifying your email...</p>
          </div>
        )}
        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-neon-cyan">Email Verified!</h2>
            <p className="mt-2 text-gray-400">Redirecting to login...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-red-400">Verification Failed</h2>
            <p className="mt-2 text-gray-500">Link is invalid or expired.</p>
            <button
              onClick={() => navigate('/resend-verification')}
              className="mt-4 px-6 py-2.5 rounded-xl text-surface-dark font-bold text-sm uppercase tracking-wider transition-all hover:shadow-neon-sm"
              style={{ background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' }}
            >
              Resend Verification Email
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}