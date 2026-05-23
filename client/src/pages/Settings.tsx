import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { api } from '../lib/api';
import {
  User, Lock, Bell, Shield, Moon, Sun, Trash2,
  ChevronRight, LogOut, Key, UserX, Eye, Clock,
  Bookmark, MessageCircle, Smartphone, Mail
} from 'lucide-react';
import { motion } from 'framer-motion';
import { pageVariants, listVariants, listItemVariants } from '../lib/animations';
import toast from 'react-hot-toast';

function DeleteAccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!password) { toast.error('Enter your password to confirm'); return; }
    setIsLoading(true);
    try {
      await api.deleteAccount(password);
      toast.success('Account deleted');
      logout();
      navigate('/login');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    } finally { setIsLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass p-6 max-w-sm w-full mx-4 shadow-card-glow" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-red-400 mb-2">Delete Account</h3>
        <p className="text-gray-500 text-sm mb-4">This will permanently delete your account and all data. This cannot be undone.</p>
        <input
          type="password"
          placeholder="Enter your password to confirm"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 mb-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500/30"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/[0.04] transition">Cancel</button>
          <button onClick={handleDelete} disabled={isLoading} className="flex-1 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl disabled:opacity-50 hover:bg-red-500/30 transition">
            {isLoading ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = async () => {
    if (!formData.currentPassword || !formData.newPassword) { toast.error('All fields are required'); return; }
    if (formData.newPassword !== formData.confirmPassword) { toast.error('New passwords do not match'); return; }
    if (formData.newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setIsLoading(true);
    try {
      await api.changePassword(formData.currentPassword, formData.newPassword);
      toast.success('Password changed successfully');
      onClose();
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally { setIsLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass p-6 max-w-sm w-full mx-4 shadow-card-glow" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-4">Change Password</h3>
        <div className="space-y-3 mb-4">
          <input type="password" placeholder="Current password" value={formData.currentPassword}
            onChange={e => setFormData({ ...formData, currentPassword: e.target.value })}
            className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30" />
          <input type="password" placeholder="New password (min 8 characters)" value={formData.newPassword}
            onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
            className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30" />
          <input type="password" placeholder="Confirm new password" value={formData.confirmPassword}
            onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/[0.04] transition">Cancel</button>
          <button onClick={handleChange} disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl text-surface-dark font-bold disabled:opacity-50 transition"
            style={{ background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' }}>
            {isLoading ? 'Saving...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeEmailModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { updateUser } = useAuthStore();

  const handleRequest = async () => {
    if (!newEmail || !password) { toast.error('All fields are required'); return; }
    setIsLoading(true);
    try {
      const data = await api.changeEmail(newEmail, password);
      setPendingEmail(data.pendingEmail || newEmail);
      setStep('verify');
      toast.success('Verification code sent to your new email');
    } catch (error: any) {
      toast.error(error.message || 'Failed to request email change');
    } finally { setIsLoading(false); }
  };

  const handleVerify = async () => {
    if (!code) { toast.error('Enter the verification code'); return; }
    setIsLoading(true);
    try {
      const data = await api.verifyEmailChange(code);
      toast.success('Email changed successfully!');
      updateUser({ email: data.email } as any);
      onClose();
      setStep('request'); setNewEmail(''); setPassword(''); setCode('');
    } catch (error: any) {
      toast.error(error.message || 'Invalid verification code');
    } finally { setIsLoading(false); }
  };

  const handleClose = () => {
    onClose();
    setStep('request'); setNewEmail(''); setPassword(''); setCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={handleClose}>
      <div className="glass p-6 max-w-sm w-full mx-4 shadow-card-glow" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{step === 'request' ? 'Change Email' : 'Verify New Email'}</h3>
            <p className="text-xs text-gray-500">{step === 'request' ? 'A verification code will be sent to your new email' : `Code sent to ${pendingEmail}`}</p>
          </div>
        </div>

        {step === 'request' ? (
          <div className="space-y-3 mb-4">
            <input type="email" placeholder="New email address" value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30" />
            <input type="password" placeholder="Current password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30" />
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            <input type="text" placeholder="6-digit verification code" value={code}
              onChange={e => setCode(e.target.value)} maxLength={6}
              className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-center text-xl tracking-[0.3em] placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30 font-mono" autoFocus />
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleClose} className="flex-1 py-2.5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/[0.04] transition">Cancel</button>
          <button onClick={step === 'request' ? handleRequest : handleVerify} disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl font-bold disabled:opacity-50 transition"
            style={{ background: 'linear-gradient(135deg, #0d9488, #00d4ff)', color: 'white' }}>
            {isLoading ? 'Processing...' : (step === 'request' ? 'Send Code' : 'Verify & Change')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const { user, logout, updateUser } = useAuthStore();
  const { theme, toggleTheme } = useUIStore();
  const navigate = useNavigate();

  const [isPrivate, setIsPrivate] = useState(user?.is_private || false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(user?.show_online_status ?? true);
  const [showLastSeen, setShowLastSeen] = useState(user?.show_last_seen ?? true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAPassword, setTwoFAPassword] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);

  // Fetch 2FA status on mount
  useEffect(() => {
    api.get2FAStatus().then((data: any) => {
      setTwoFAEnabled(data.two_fa_enabled || false);
    }).catch(() => {});
  }, []);

  const handle2FAToggle = async () => {
    if (!twoFAPassword) { toast.error('Enter your password to confirm'); return; }
    setTwoFALoading(true);
    try {
      if (twoFAEnabled) {
        await api.disable2FA(twoFAPassword);
        setTwoFAEnabled(false);
        toast.success('Two-factor authentication disabled');
      } else {
        await api.enable2FA(twoFAPassword);
        setTwoFAEnabled(true);
        toast.success('Two-factor authentication enabled! You will receive a code via email on next login.');
      }
      setShow2FAModal(false);
      setTwoFAPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update 2FA');
    } finally { setTwoFALoading(false); }
  };

  const togglePrivacy = async () => {
    try {
      await api.updatePrivacy(!isPrivate);
      const newVal = !isPrivate;
      setIsPrivate(newVal);
      updateUser({ is_private: newVal });
      toast.success(`Account is now ${newVal ? 'private' : 'public'}`);
    } catch { toast.error('Failed to update privacy'); }
  };

  const toggleOnlineStatus = async () => {
    try {
      const newVal = !showOnlineStatus;
      await api.updateOnlinePrivacy(newVal, undefined);
      setShowOnlineStatus(newVal);
      updateUser({ show_online_status: newVal } as any);
      toast.success(`Online status is now ${newVal ? 'visible' : 'hidden'}`);
    } catch { toast.error('Failed to update'); }
  };

  const toggleLastSeen = async () => {
    try {
      const newVal = !showLastSeen;
      await api.updateOnlinePrivacy(undefined, newVal);
      setShowLastSeen(newVal);
      updateUser({ show_last_seen: newVal } as any);
      toast.success(`Last seen is now ${newVal ? 'visible' : 'hidden'}`);
    } catch { toast.error('Failed to update'); }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const row = 'flex items-center justify-between p-4 hover:bg-white/[0.03] transition-all duration-200';
  const icon = 'flex items-center gap-3';
  const divider = 'border-t border-white/[0.04]';
  const card = 'glass overflow-hidden';

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className="relative w-12 h-6 rounded-full transition-colors"
      style={{ background: on ? 'linear-gradient(135deg, var(--color-accent), #00d4ff)' : 'var(--input-bg)', border: on ? 'none' : '1px solid var(--color-border)' }}
    >
      <div className={`absolute w-5 h-5 rounded-full top-0.5 transition-transform shadow ${on ? 'translate-x-6' : 'translate-x-0.5'}`} style={{ background: on ? 'var(--color-surface-card)' : 'var(--color-text-muted)' }} />
    </button>
  );

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="max-w-2xl mx-auto p-4 pb-20"
    >
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-4">
        {/* ── Account ───────────────────────────────────────────── */}
        <motion.div variants={listItemVariants}>
          <p className="section-label px-1 mb-2">Account</p>
          <div className={card}>
            <Link to="/settings/edit" className={`${row} block`}>
              <div className={icon}><User className="w-5 h-5 text-neon-cyan" /><span className="text-gray-200">Edit Profile</span></div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </Link>
            <button onClick={() => setShowChangePassword(true)} className={`w-full ${row} ${divider}`}>
              <div className={icon}><Key className="w-5 h-5 text-neon-cyan" /><span className="text-gray-200">Change Password</span></div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <button onClick={() => setShowChangeEmail(true)} className={`w-full ${row} ${divider}`}>
              <div className={icon}><Mail className="w-5 h-5 text-teal-400" /><div><span className="block text-gray-200">Change Email</span><span className="text-xs text-gray-500">{user?.email}</span></div></div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <div className={`${row} ${divider}`}>
              <div className={icon}><Lock className="w-5 h-5 text-neon-cyan" /><div><span className="block text-gray-200">Private Account</span><span className="text-xs text-gray-500">Only approved followers can see your posts</span></div></div>
              <Toggle on={isPrivate} onToggle={togglePrivacy} />
            </div>
            <button onClick={() => setShow2FAModal(true)} className={`w-full ${row} ${divider}`}>
              <div className={icon}><Smartphone className="w-5 h-5 text-purple-400" /><div><span className="block text-gray-200">Two-Factor Authentication</span><span className="text-xs text-gray-500">{twoFAEnabled ? 'Email OTP required on login' : 'Add extra security to your account'}</span></div></div>
              <span className={`text-xs px-2 py-1 rounded-lg font-medium ${twoFAEnabled ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'}`}>
                {twoFAEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </motion.div>

        {/* ── Privacy ───────────────────────────────────────────── */}
        <motion.div variants={listItemVariants}>
          <p className="section-label px-1 mb-2">Privacy</p>
          <div className={card}>
            <div className={row}>
              <div className={icon}>
                <Eye className="w-5 h-5 text-neon-cyan" />
                <div><span className="block text-gray-200">Show Online Status</span><span className="text-xs text-gray-500">Others can see when you're active</span></div>
              </div>
              <Toggle on={showOnlineStatus} onToggle={toggleOnlineStatus} />
            </div>
            <div className={`${row} ${divider}`}>
              <div className={icon}>
                <Clock className="w-5 h-5 text-gray-400" />
                <div><span className="block text-gray-200">Show Last Seen</span><span className="text-xs text-gray-500">Others can see when you were last online</span></div>
              </div>
              <Toggle on={showLastSeen} onToggle={toggleLastSeen} />
            </div>
            <Link to="/settings/blocked" className={`${row} ${divider} block`}>
              <div className={icon}><UserX className="w-5 h-5 text-gray-400" /><span className="text-gray-200">Blocked Users</span></div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </Link>
            <Link to="/settings/follow-requests" className={`${row} ${divider} block`}>
              <div className={icon}><Shield className="w-5 h-5 text-gray-400" /><span className="text-gray-200">Follow Requests</span></div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </Link>
          </div>
        </motion.div>

        {/* ── Content ───────────────────────────────────────────── */}
        <motion.div variants={listItemVariants}>
          <p className="section-label px-1 mb-2">Content</p>
          <div className={card}>
            <Link to="/saved" className={`${row} block`}>
              <div className={icon}><Bookmark className="w-5 h-5 text-amber-400" /><span className="text-gray-200">Saved Posts</span></div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </Link>
            <Link to="/notifications" className={`${row} ${divider} block`}>
              <div className={icon}><Bell className="w-5 h-5 text-neon-cyan" /><span className="text-gray-200">Notifications</span></div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </Link>
            <Link to="/messages" className={`${row} ${divider} block`}>
              <div className={icon}><MessageCircle className="w-5 h-5 text-gray-400" /><span className="text-gray-200">Messages</span></div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </Link>
          </div>
        </motion.div>

        {/* ── Preferences ──────────────────────────────────────── */}
        <motion.div variants={listItemVariants}>
          <p className="section-label px-1 mb-2">Preferences</p>
          <div className={card}>
            <div className={row}>
              <div className={icon}>
                {theme === 'dark' ? <Moon className="w-5 h-5 text-neon-cyan" /> : <Sun className="w-5 h-5 text-yellow-400" />}
                <div><span className="block text-gray-200">Dark Mode</span><span className="text-xs text-gray-500">Switch between light and dark themes</span></div>
              </div>
              <Toggle on={theme === 'dark'} onToggle={toggleTheme} />
            </div>
          </div>
        </motion.div>

        {/* ── Session ──────────────────────────────────────────── */}
        <motion.div variants={listItemVariants}>
          <p className="section-label px-1 mb-2">Session</p>
          <div className={card}>
            <button onClick={handleLogout} className={`w-full ${row} text-left`}>
              <div className={icon}><LogOut className="w-5 h-5 text-gray-400" /><span className="text-gray-200">Log Out</span></div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </motion.div>

        {/* ── Danger Zone ──────────────────────────────────────── */}
        <motion.div variants={listItemVariants}>
          <p className="section-label px-1 mb-2 text-red-400">Danger Zone</p>
          <div className={card}>
            <button onClick={() => setShowDeleteModal(true)} className={`w-full ${row} text-left`}>
              <div className={icon}><Trash2 className="w-5 h-5 text-red-400" /><span className="text-red-400">Delete Account</span></div>
              <ChevronRight className="w-5 h-5 text-red-400/40" />
            </button>
          </div>
        </motion.div>

        {/* App info footer */}
        <motion.div variants={listItemVariants} className="text-center pt-4 pb-8">
          <p className="text-xs text-gray-600">SocialConnect v1.0</p>
          <p className="text-[10px] text-gray-600 mt-1">ADBMS PBL Project · {new Date().getFullYear()}</p>
        </motion.div>
      </motion.div>

      <DeleteAccountModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
      <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
      <ChangeEmailModal isOpen={showChangeEmail} onClose={() => setShowChangeEmail(false)} />

      {/* 2FA Password Confirmation Modal */}
      {show2FAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setShow2FAModal(false); setTwoFAPassword(''); }}>
          <div className="glass p-6 max-w-sm w-full mx-4 shadow-card-glow" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{twoFAEnabled ? 'Disable' : 'Enable'} 2FA</h3>
                <p className="text-xs text-gray-500">{twoFAEnabled ? 'Remove email verification on login' : 'Require email code on every login'}</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">Enter your password to confirm:</p>
            <input
              type="password"
              placeholder="Your password"
              value={twoFAPassword}
              onChange={e => setTwoFAPassword(e.target.value)}
              className="w-full px-4 py-2.5 mb-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => { setShow2FAModal(false); setTwoFAPassword(''); }} className="flex-1 py-2.5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/[0.04] transition">Cancel</button>
              <button onClick={handle2FAToggle} disabled={twoFALoading}
                className="flex-1 py-2.5 rounded-xl font-bold disabled:opacity-50 transition"
                style={{ background: twoFAEnabled ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg, #a855f7, #7c3aed)', color: twoFAEnabled ? '#ef4444' : 'white', border: twoFAEnabled ? '1px solid rgba(239,68,68,0.3)' : 'none' }}>
                {twoFALoading ? 'Processing...' : (twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA')}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
