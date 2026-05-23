import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Search, Compass, Heart, Settings,
  LogOut, Shield, Sun, Moon, MessageCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNotificationStore } from '../../store/useNotifications';
import { api } from '../../lib/api';
import { Avatar } from '../ui/Avatar';

export function Navbar() {
  const { user, logout, token } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount, startPolling, stopPolling } = useNotificationStore();
  const { theme, toggleTheme } = useUIStore();

  useEffect(() => {
    if (token) startPolling();
    return () => stopPolling();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.heartbeat().catch(() => {});
    const hb = setInterval(() => api.heartbeat().catch(() => {}), 60_000);
    return () => clearInterval(hb);
  }, [token]);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 backdrop-blur-2xl border-b"
      style={{ background: 'var(--glass-bg)', borderColor: 'var(--color-border)' }}
    >
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">

          {/* ── Left: Logo ──────────────────────────────────────────────── */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl font-black text-neon tracking-tight">SocialConnect</span>
          </Link>

          {/* ── Center: Icon nav (desktop) ──────────────────────────────── */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { to: '/',              Icon: Home,           label: 'Home' },
              { to: '/search',        Icon: Compass,        label: 'Discover' },
              { to: '/notifications', Icon: Heart,          label: 'Notifications', badge: unreadCount },
              { to: '/messages',      Icon: MessageCircle,  label: 'Messages' },
              { to: '/settings',      Icon: Settings,       label: 'Settings' },
            ].map(({ to, Icon, label, badge }) => (
              <Link
                key={to}
                to={to}
                title={label}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(to)
                    ? 'text-neon-cyan'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                style={isActive(to) ? { background: 'var(--color-accent-soft)' } : undefined}
              >
                <Icon size={18} fill={isActive(to) ? 'currentColor' : 'none'} />
                <span className="hidden lg:inline">{label}</span>

                {/* Notification badge */}
                {badge != null && badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 left-[26px] lg:relative lg:top-auto lg:left-auto min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full badge-pulse"
                    style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)' }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </motion.span>
                )}
              </Link>
            ))}
          </div>

          {/* ── Right: Search, Theme, Avatar, Logout (desktop) ──────────── */}
          <div className="hidden md:flex items-center gap-2">
            {/* Search pill */}
            <Link
              to="/search"
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-sm transition-all duration-200"
              style={{
                background: 'var(--color-accent-soft)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Search size={14} />
              <span className="hidden lg:inline">Search...</span>
            </Link>

            {/* Theme toggle */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              <motion.div key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </motion.div>
            </motion.button>

            {/* Admin */}
            {user?.is_admin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors"
                title="Admin Panel"
              >
                <Shield size={14} />
                <span className="text-xs font-bold">Admin</span>
              </Link>
            )}

            {/* Profile avatar */}
            <Link
              to={`/profile/${user?.username}`}
              className={`p-0.5 rounded-full transition-all duration-300 ring-2 ${
                isActive('/profile') ? 'ring-neon-cyan shadow-neon-sm' : 'ring-transparent'
              }`}
              title="Profile"
            >
              <Avatar src={user?.avatar_url} alt={user?.username} size="sm" />
            </Link>

            {/* Logout */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <LogOut size={16} className="text-gray-500 hover:text-red-400 transition-colors" />
            </motion.button>
          </div>

          {/* ── Mobile: theme + avatar ──────────────────────────────────── */}
          <div className="md:hidden flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-lg" style={{ color: 'var(--color-text-secondary)' }}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to={`/profile/${user?.username}`}>
              <Avatar src={user?.avatar_url} alt={user?.username} size="sm" />
            </Link>
          </div>

        </div>
      </div>
    </nav>
  );
}