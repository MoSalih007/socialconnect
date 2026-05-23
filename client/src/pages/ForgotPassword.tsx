import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.requestPasswordReset(email);
      setSent(true);
      toast.success('Reset link sent!');
    } catch {
      toast.error('Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dark px-4 relative">
      {/* Background */}
      <div className="fixed inset-0 opacity-20" style={{
        background: `radial-gradient(ellipse at 50% 50%, rgba(0, 255, 209, 0.15) 0%, transparent 60%)`,
      }} />
      <div className="fixed inset-0 opacity-30" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative max-w-md w-full"
      >
        <div className="glass p-8 shadow-card-glow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #00FFD1, transparent)' }} />

          {sent ? (
            <div className="text-center">
              <div className="text-6xl mb-4">📧</div>
              <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
              <p className="text-gray-400 mb-4">We sent you a password reset link</p>
              <Link to="/login" className="text-neon-cyan hover:underline font-medium">Back to Login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Reset Password</h2>
                <p className="text-sm text-gray-500">Enter your email to receive a reset link</p>
              </div>

              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Button type="submit" isLoading={isLoading} className="w-full">
                Send Reset Link
              </Button>

              <div className="text-center">
                <Link to="/login" className="text-sm text-neon-cyan hover:underline font-medium">Back to Login</Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}