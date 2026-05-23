import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Users, FileText, MessageSquare,
  AlertTriangle, CheckCircle, RefreshCw,
  FileWarning, ScrollText, ArrowUpRight
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Stats {
  users: number;
  posts: number;
  messages: number;
  pendingReports?: number;
  flaggedPosts?: number;
}

// Animated counter hook
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(undefined);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);

  return value;
}

function StatCard({ icon: Icon, label, value, color, delay, link }: {
  icon: any; label: string; value: number; color: string; delay: number; link: string;
}) {
  const animatedValue = useCountUp(value);
  const gradients: Record<string, string> = {
    cyan: 'linear-gradient(135deg, rgba(0,255,209,0.12), rgba(0,212,255,0.06))',
    purple: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(139,92,246,0.06))',
    green: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(16,185,129,0.06))',
    amber: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))',
    red: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.06))',
  };
  const iconColors: Record<string, string> = {
    cyan: '#00FFD1', purple: '#a855f7', green: '#34d399', amber: '#fbbf24', red: '#ef4444',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.4, ease: 'easeOut' }}
    >
      <Link
        to={link}
        className="block glass p-5 hover:border-white/[0.1] transition-all duration-300 group"
        style={{ background: gradients[color] }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.06]">
            <Icon size={20} style={{ color: iconColors[color] }} />
          </div>
          <ArrowUpRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
        </div>
        <p className="text-3xl font-black text-white mb-1">{animatedValue.toLocaleString()}</p>
        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      </Link>
    </motion.div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadAll();
    // Auto-refresh every 30s
    const interval = setInterval(() => { loadStats(true); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = () => { loadStats(); loadReports(); };

  const loadStats = async (silent = false) => {
    if (!silent) setStatsLoading(true);
    else setIsRefreshing(true);
    setStatsError('');
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (error: any) {
      if (!silent) setStatsError(error.message || 'Failed to load stats');
    } finally {
      setStatsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadReports = async () => {
    try {
      const data = await api.getReports();
      setRecentReports(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch { setRecentReports([]); }
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan animate-spin" />
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (statsError || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center glass p-8 max-w-sm">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Failed to Load</h2>
          <p className="text-gray-500 text-sm mb-4">{statsError || 'Could not reach the server'}</p>
          <button onClick={loadAll} className="btn-primary !py-2 !px-5 !text-xs">
            <RefreshCw size={14} className="mr-2 inline" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const pendingCount = recentReports.filter(r => r.status === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">Platform overview & management</p>
        </div>
        <button
          onClick={() => loadStats(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Users} label="Total Users" value={stats.users} color="cyan" delay={0} link="/admin/users" />
        <StatCard icon={FileText} label="Total Posts" value={stats.posts} color="purple" delay={1} link="/admin/moderation" />
        <StatCard icon={MessageSquare} label="Messages" value={stats.messages} color="green" delay={2} link="/admin" />
        <StatCard icon={AlertTriangle} label="Pending Reports" value={stats.pendingReports || 0} color="amber" delay={3} link="/admin/reports" />
        <StatCard icon={FileWarning} label="Flagged Posts" value={stats.flaggedPosts || 0} color="red" delay={4} link="/admin/moderation" />
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
      >
        {[
          { to: '/admin/reports', icon: AlertTriangle, label: 'Review Reports', desc: `${pendingCount} pending`, color: 'text-amber-400' },
          { to: '/admin/users', icon: Users, label: 'Manage Users', desc: `${stats.users} users`, color: 'text-neon-cyan' },
          { to: '/admin/moderation', icon: FileWarning, label: 'Moderation', desc: `${stats.flaggedPosts || 0} flagged`, color: 'text-red-400' },
          { to: '/admin/audit-log', icon: ScrollText, label: 'Audit Log', desc: 'Track actions', color: 'text-purple-400' },
        ].map((item, i) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.08 }}
          >
            <Link
              to={item.to}
              className="block glass p-4 hover:bg-white/[0.04] transition-all group"
            >
              <item.icon className={`w-6 h-6 ${item.color} mb-2`} />
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{item.desc}</p>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Reports */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Reports</h2>
          <Link to="/admin/reports" className="text-xs text-neon-cyan hover:underline font-semibold">View All →</Link>
        </div>

        {recentReports.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-neon-green opacity-50" />
            <p className="text-gray-500 text-sm">No reports to review</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {recentReports.map((report) => (
              <div key={report.id} className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition">
                <div className={`w-2 h-2 rounded-full shrink-0 ${report.status === 'pending' ? 'bg-amber-400' : 'bg-green-400'}`}
                  style={report.status === 'pending' ? { boxShadow: '0 0 6px rgba(251,191,36,0.5)' } : undefined}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300">
                    <span className="font-semibold text-white">{report.reporter_username}</span>
                    {' '}reported{' '}
                    <span className="font-semibold text-white">{report.reported_username}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{report.reason} · {new Date(report.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                  report.status === 'pending'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-green-500/10 text-green-400 border border-green-500/20'
                }`}>
                  {report.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}