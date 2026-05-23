import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success'>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    api.verifyResetToken(token)
      .then(() => setStatus('valid'))
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    setIsSubmitting(true);
    try {
      await api.resetPassword(token!, password);
      setStatus('success');
      toast.success('Password reset successful!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error: any) {
      toast.error(error.message || 'Reset failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const wrapper = "min-h-screen flex items-center justify-center bg-surface-dark px-4 relative";
  const bgGlow = (
    <>
      <div className="fixed inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,255,209,0.15) 0%, transparent 60%)' }} />
      <div className="fixed inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
    </>
  );

  if (status === 'loading') {
    return (
      <div className={wrapper}>
        {bgGlow}
        <div className="relative text-center">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verifying token...</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className={wrapper}>
        {bgGlow}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative glass max-w-md w-full text-center p-8 shadow-card-glow">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-400 mb-2">Invalid Link</h2>
          <p className="text-gray-400 mb-6">This password reset link is invalid or has expired.</p>
          <Link to="/forgot-password">
            <Button className="w-full">Request New Link</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className={wrapper}>
        {bgGlow}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative glass max-w-md w-full text-center p-8 shadow-card-glow">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-neon-cyan mb-2">Password Reset!</h2>
          <p className="text-gray-400 mb-2">Your password has been successfully reset.</p>
          <p className="text-sm text-gray-600">Redirecting to login...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      {bgGlow}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative max-w-md w-full">
        <div className="glass p-8 shadow-card-glow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #00FFD1, transparent)' }} />
          <div className="text-center mb-6">
            <h1 className="text-xl font-black text-neon mb-2">SocialConnect</h1>
            <p className="text-gray-500 text-sm">Create a new password</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="password" placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            <p className="text-xs text-gray-500">Password must be 8+ characters with uppercase, lowercase, and number</p>
            <Button type="submit" isLoading={isSubmitting} className="w-full">Reset Password</Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}