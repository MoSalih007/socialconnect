import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Users, Home, LogOut, FileWarning, ScrollText, Menu, X, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/ui/Avatar';

const NAV_ITEMS = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/admin/reports', icon: AlertTriangle, label: 'Reports' },
  { path: '/admin/users', icon: Users, label: 'Users' },
  { path: '/admin/moderation', icon: FileWarning, label: 'Moderation' },
  { path: '/admin/audit-log', icon: ScrollText, label: 'Audit Log' },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <>
      {/* Logo / header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' }}>
            <Shield size={20} className="text-surface-dark" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Admin Panel</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">SocialConnect</p>
          </div>
        </div>
      </div>

      {/* Admin profile */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Avatar src={user?.avatar_url} alt={user?.username} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
            <p className="text-[10px] text-neon-cyan font-bold uppercase tracking-wider">Administrator</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path, item.exact);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? 'text-neon-cyan'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
              }`}
              style={active ? { background: 'var(--color-accent-soft)' } : undefined}
            >
              <item.icon size={18} fill={active ? 'currentColor' : 'none'} />
              {item.label}
              {active && (
                <motion.div
                  layoutId="admin-nav-active"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-cyan"
                  style={{ boxShadow: '0 0 8px rgba(0, 255, 209, 0.5)' }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-white/[0.06] space-y-1">
        <Link
          to="/"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all"
        >
          <Home size={18} />
          Back to App
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/[0.06] transition-all"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen" style={{ background: 'var(--color-surface-dark)' }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col glass border-r border-white/[0.06] shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-64 z-50 flex flex-col glass md:hidden"
            >
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/[0.06] text-gray-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] backdrop-blur-xl" style={{ background: 'var(--glass-bg)' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.04] transition">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-neon-cyan" />
            <span className="text-sm font-bold text-white">Admin</span>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}