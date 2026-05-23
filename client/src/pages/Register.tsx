import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { validateEmail, validatePassword, validateUsername } from '../lib/validation';
import { api } from '../lib/api';
import { UserPlus, Shield, Zap, MessageCircle, Image, Users, Lock, Heart, Camera } from 'lucide-react';
import { motion } from 'framer-motion';

const FEATURES = [
  { icon: MessageCircle, title: 'Encrypted Messaging', desc: 'AES-256 server-side encrypted private conversations' },
  { icon: Image, title: 'Stories & Posts', desc: 'Share moments with photos, videos & 24-hour stories' },
  { icon: Shield, title: 'Device Security', desc: 'PIN-based device verification keeps your account safe' },
  { icon: Users, title: 'Social Feed', desc: 'Follow friends and discover trending content' },
  { icon: Lock, title: 'Privacy Controls', desc: 'Private accounts, blocking, and granular settings' },
  { icon: Heart, title: 'Likes & Comments', desc: 'Engage with the community through reactions' },
  { icon: Camera, title: 'Cloud Media', desc: 'Cloudinary-powered image & video hosting' },
  { icon: Zap, title: 'Real-Time Alerts', desc: 'Stay updated with instant notifications' },
];

export function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', email: '', password: '', full_name: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveFeature((prev) => (prev + 1) % FEATURES.length);
        setIsTransitioning(false);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const usernameError = validateUsername(formData.username);
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    if (usernameError || emailError || passwordError) {
      setErrors({
        ...(usernameError && { username: usernameError }),
        ...(emailError && { email: emailError }),
        ...(passwordError && { password: passwordError }),
      });
      return;
    }
    setIsLoading(true);
    try {
      await api.register(formData);
      setSuccess(true);
      setTimeout(() => navigate('/login', { state: { registered: true } }), 3000);
    } catch (error: any) {
      setErrors({ general: error.message || 'Registration failed' });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-dark px-4 relative">
        <div className="fixed inset-0 opacity-20" style={{
          background: `radial-gradient(ellipse at 50% 50%, rgba(0, 255, 209, 0.3) 0%, transparent 60%)`,
        }} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative glass max-w-md w-full text-center p-10 shadow-card-glow"
        >
          <div className="text-6xl mb-5">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">Account Created!</h2>
          <p className="text-gray-400">Check your email to verify your account, then log in.</p>
          <p className="text-sm text-gray-600 mt-5">Redirecting to login...</p>
        </motion.div>
      </div>
    );
  }

  const feat = FEATURES[activeFeature];
  const FeatIcon = feat.icon;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden relative bg-surface-dark">
      {/* Background */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 opacity-20" style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(0, 255, 209, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(0, 212, 255, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 40% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)
          `,
          animation: 'meshShift 12s ease-in-out infinite alternate',
        }} />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
      </div>

      {/* LEFT: Hero — hidden on mobile */}
      <div className="relative hidden lg:flex flex-1 flex-col items-center justify-center px-8 z-10">
        <div className="absolute top-[10%] left-[15%] w-64 h-64 bg-neon-cyan/5 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-[15%] right-[10%] w-72 h-72 bg-neon-blue/5 rounded-full blur-[100px] animate-float-slow" />

        <div className="relative z-10 text-center max-w-lg">
          <h1 className="text-7xl font-black mb-3 tracking-tight text-neon">
            SocialConnect
          </h1>
          <p className="text-gray-400 text-lg mb-12 leading-relaxed max-w-sm mx-auto">
            Join a community that values your privacy and brings people closer together.
          </p>

          {/* Feature card */}
          <div className="relative h-48 mb-8">
            <div className={`absolute inset-0 transition-all duration-500 ease-out ${isTransitioning ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100 scale-100 translate-y-0'}`}>
              <div className="h-full glass p-7 flex flex-col items-center justify-center text-white relative overflow-hidden group">
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{
                  background: 'linear-gradient(135deg, rgba(0,255,209,0.2), rgba(0,212,255,0.2))',
                  boxShadow: '0 0 30px rgba(0, 255, 209, 0.15)',
                }}>
                  <FeatIcon className="w-7 h-7 text-neon-cyan" />
                </div>
                <h3 className="text-xl font-bold mb-1.5 relative z-10">{feat.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed relative z-10">{feat.desc}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-2 mb-10">
            {FEATURES.map((_, i) => (
              <button key={i} onClick={() => { setIsTransitioning(true); setTimeout(() => { setActiveFeature(i); setIsTransitioning(false); }, 300); }} className="relative p-1 group">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${i === activeFeature ? 'w-8 bg-neon-cyan' : 'w-1.5 bg-gray-600 group-hover:bg-gray-400'}`} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Register form */}
      <div className="relative flex-1 flex items-center justify-center px-5 py-8 lg:px-6 lg:py-0 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full space-y-4"
        >
          {/* Mobile branding */}
          <div className="text-center lg:hidden mb-4">
            <h1 className="text-4xl sm:text-5xl font-black mb-2 tracking-tight text-neon">SocialConnect</h1>
            <p className="text-gray-500 text-sm">Join the community today</p>
          </div>

          <div className="glass p-6 sm:p-8 shadow-card-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #00FFD1, transparent)' }} />

            <h2 className="text-xl font-bold text-white mb-1 text-center">Create your account</h2>
            <p className="text-gray-500 text-sm text-center mb-6">It only takes a minute</p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <Input placeholder="Username" value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })} error={errors.username} />
              <Input type="email" placeholder="Email address" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} error={errors.email} />
              <Input placeholder="Full Name (optional)" value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
              <Input type="password" placeholder="Password" value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })} error={errors.password} />

              <p className="text-xs text-gray-500">Must contain uppercase, lowercase, and a number</p>

              {errors.general && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {errors.general}
                </div>
              )}

              <Button type="submit" className="w-full" isLoading={isLoading}>
                <UserPlus className="w-4 h-4 mr-2" />
                Create Account
              </Button>
            </form>
          </div>

          <div className="glass p-5 text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-neon-cyan font-semibold hover:underline">Log in</Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-600">
            SocialConnect · ADBMS PBL Project · {new Date().getFullYear()}
          </p>
        </motion.div>
      </div>
    </div>
  );
}