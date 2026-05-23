import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { validateEmail } from '../lib/validation';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { getDeviceFingerprint } from '../lib/fingerprint';
import { PinSetup } from '../components/auth/PinSetup';
import { PinVerify } from '../components/auth/PinVerify';
import { Shield, Users, MessageCircle, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // PIN states
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinVerify, setShowPinVerify] = useState(false);
  const [fingerprint, setFingerprint] = useState('');
  const [pendingAuth, setPendingAuth] = useState<{ token: string; user: any } | null>(null);

  // 2FA states
  const [show2FA, setShow2FA] = useState(false);
  const [twoFAEmail, setTwoFAEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    getDeviceFingerprint().then(setFingerprint);
  }, []);

  const registered = (location.state as any)?.registered;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const emailError = validateEmail(formData.email);
    if (emailError) { setErrors({ email: emailError }); return; }
    if (!formData.password) { setErrors({ password: 'Password is required' }); return; }

    setIsLoading(true);
    try {
      const loginData = await api.login(formData);

      // 2FA check: if server says 2FA is required, show OTP screen
      if (loginData.requires2FA) {
        setTwoFAEmail(loginData.email);
        setShow2FA(true);
        setIsLoading(false);
        return;
      }

      localStorage.setItem('token', loginData.token);
      // Store refresh token for automatic token rotation
      if (loginData.refreshToken) {
        localStorage.setItem('refreshToken', loginData.refreshToken);
      }

      try {
        const deviceStatus = await api.checkDeviceStatus(fingerprint);
        if (deviceStatus.needsSetup) {
          setPendingAuth(loginData);
          setShowPinSetup(true);
          return;
        } else if (deviceStatus.needsVerification) {
          setPendingAuth(loginData);
          setShowPinVerify(true);
          return;
        }
      } catch {
        console.warn('Device check skipped');
      }

      login(loginData.token, loginData.user);
      navigate('/');
    } catch (error: any) {
      localStorage.removeItem('token');
      if (error.requiresVerification) {
        setErrors({ general: 'Please verify your email address before logging in.' });
      } else if (error.mustResetPassword) {
        setErrors({ general: 'Your password must be reset. Please use the "Forgot Password" link below.' });
      } else {
        setErrors({ general: error.message || 'Login failed. Check your email and password.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSetupComplete = () => {
    if (pendingAuth) { login(pendingAuth.token, pendingAuth.user); navigate('/'); }
  };
  const handlePinVerifySuccess = () => {
    if (pendingAuth) { login(pendingAuth.token, pendingAuth.user); navigate('/'); }
  };

  if (showPinSetup && pendingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-dark px-4">
        <PinSetup fingerprint={fingerprint} onComplete={handlePinSetupComplete} />
      </div>
    );
  }
  if (showPinVerify && pendingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-dark px-4">
        <PinVerify fingerprint={fingerprint} onSuccess={handlePinVerifySuccess} />
      </div>
    );
  }

  // 2FA OTP Verification Screen
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setErrors({ general: 'Please enter the 6-digit code' });
      return;
    }
    setIsLoading(true);
    try {
      const loginData = await api.verify2FA(twoFAEmail, otpCode);
      localStorage.setItem('token', loginData.token);
      if (loginData.refreshToken) {
        localStorage.setItem('refreshToken', loginData.refreshToken);
      }
      login(loginData.token, loginData.user);
      navigate('/');
    } catch (error: any) {
      setErrors({ general: error.message || 'Invalid verification code' });
    } finally {
      setIsLoading(false);
    }
  };

  if (show2FA) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center px-4">
        <div className="fixed inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle, var(--dot-color) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="glass p-8 max-w-md w-full shadow-card-glow relative overflow-hidden z-10"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #a855f7, transparent)' }} />

          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Two-Factor Authentication</h2>
            <p className="text-gray-500 text-sm mt-2">
              A 6-digit code was sent to<br />
              <span className="text-purple-400 font-medium">{twoFAEmail}</span>
            </p>
          </div>

          <form onSubmit={handle2FASubmit} className="space-y-4">
            <div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full text-center text-3xl font-bold tracking-[0.5em] py-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition"
                autoFocus
              />
            </div>

            {errors.general && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {errors.general}
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Verify & Log In
            </Button>

            <button
              type="button"
              onClick={() => { setShow2FA(false); setOtpCode(''); setErrors({}); }}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition"
            >
              ← Back to Login
            </button>

            <p className="text-xs text-gray-600 text-center">
              Code expires in 10 minutes. Check your spam folder.
            </p>
          </form>
        </motion.div>
      </div>
    );
  }

  const features = [
    { icon: Shield, title: 'Private & Secure', desc: 'Your account is protected with device-based PIN verification and encrypted sessions.' },
    { icon: Users, title: 'Connect with Friends', desc: 'Follow your friends, share posts, and stay updated with their latest moments.' },
    { icon: MessageCircle, title: 'Real-Time Messaging', desc: 'Chat with friends instantly with image sharing, emojis, and read receipts.' },
  ];

  const scrollToFeatures = () => {
    document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-surface-dark overflow-hidden">
      {/* Dot grid background */}
      <div className="fixed inset-0 opacity-30" style={{
        backgroundImage: 'radial-gradient(circle, var(--dot-color) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      {/* Floating orbs */}
      <div className="fixed top-[10%] left-[5%] w-[400px] h-[400px] bg-neon-cyan/5 rounded-full blur-[120px] animate-float" />
      <div className="fixed bottom-[10%] right-[10%] w-[350px] h-[350px] bg-neon-blue/5 rounded-full blur-[120px] animate-float-slow" />

      {/* Top nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5">
        <span className="text-xl font-black text-neon">SocialConnect</span>
        <Link to="/register">
          <Button size="sm" className="!text-xs">Sign Up</Button>
        </Link>
      </nav>

      {/* Hero section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-8 lg:pt-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left: Hero text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="pt-8 lg:pt-16"
          >
            <h1 className="text-5xl lg:text-7xl font-black leading-[1.05] mb-6">
              Share Your<br />
              <span className="text-neon italic">Moments.</span>
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed max-w-md mb-8">
              Connect with friends, share photos and videos,
              and discover what's happening in your world — all in one place.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link to="/register">
                <Button size="lg">Create Account</Button>
              </Link>
              <button
                onClick={scrollToFeatures}
                className="px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300"
                style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-text-primary)' }}
              >
                Learn More
              </button>
            </div>
          </motion.div>

          {/* Right: Login card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="glass p-8 lg:p-10 shadow-card-glow relative overflow-hidden">
              {/* Top glow line */}
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)' }} />

              <h2 className="text-2xl font-bold text-white mb-1">Welcome Back</h2>
              <p className="text-gray-500 text-sm mb-6">Log in to your SocialConnect account.</p>

              {registered && (
                <div className="p-3 mb-4 bg-neon-cyan/10 border border-neon-cyan/20 rounded-xl text-neon-cyan text-sm text-center">
                  ✅ Account created! Please verify your email then log in.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={errors.email}
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  error={errors.password}
                />

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-gray-400">
                    <input type="checkbox" className="rounded bg-black/40 border-white/10 text-neon-cyan focus:ring-neon-cyan/30" />
                    <span>Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="text-neon-cyan hover:underline text-xs font-medium">
                    Forgot Password?
                  </Link>
                </div>

                {errors.general && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {errors.general}
                  </div>
                )}

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Log In
                </Button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-5">
                Don't have an account?{' '}
                <Link to="/register" className="text-neon-cyan font-semibold hover:underline">
                  Sign Up
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features section */}
      <div id="features-section" className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-3">Why SocialConnect?</h2>
          <p className="text-gray-500">Everything you need to stay connected with the people who matter.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feat, i) => {
            const FIcon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass p-8 hover:border-neon-cyan/20 hover:shadow-neon-sm transition-all duration-500 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 flex items-center justify-center mb-5 group-hover:bg-neon-cyan/20 transition-colors">
                  <FIcon className="w-6 h-6 text-neon-cyan" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feat.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-2">
            Your Social Space,<br />
            <span className="text-neon italic">Your Way.</span>
          </h2>
          <p className="text-gray-400 max-w-md text-sm leading-relaxed mt-3">
            SocialConnect is an ADBMS PBL project designed
            to bring people together through sharing, messaging,
            and meaningful connections.
          </p>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] py-6 text-center">
        <p className="text-xs text-gray-600">
          SocialConnect · ADBMS PBL Project · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}