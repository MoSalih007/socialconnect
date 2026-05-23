import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { AlertTriangle, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

export function ReportsQueue() {
  const [reports, setReports] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    setIsLoading(true);
    try { const data = await api.getReports(); setReports(data); }
    catch { toast.error('Failed to load reports'); }
    finally { setIsLoading(false); }
  };

  const handleResolve = async (reportId: number) => {
    setResolving(reportId);
    try {
      await api.resolveReport(reportId);
      setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
      toast.success('Report resolved');
    } catch { toast.error('Failed to resolve'); }
    finally { setResolving(null); }
  };

  const filteredReports = reports.filter(r => filter === 'all' ? true : r.status === filter);
  const counts = {
    pending: reports.filter(r => r.status === 'pending').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    all: reports.length,
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Reports</h1>
          <p className="text-xs text-gray-500 mt-1">Review and moderate reported content</p>
        </div>
        <button onClick={loadReports} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] transition">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5">
        {(['pending', 'resolved', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              filter === f
                ? 'text-surface-dark'
                : 'text-gray-400 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06]'
            }`}
            style={filter === f ? { background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' } : undefined}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass p-5"><div className="h-4 w-2/3 skeleton rounded mb-2" /><div className="h-3 w-1/2 skeleton rounded" /></div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filteredReports.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-card flex items-center justify-center">
            {filter === 'pending' ? <Check className="w-7 h-7 text-neon-green" /> : <AlertTriangle className="w-7 h-7 text-gray-600" />}
          </div>
          <p className="text-gray-400 font-medium">{filter === 'pending' ? 'All caught up!' : `No ${filter} reports`}</p>
        </motion.div>
      )}

      {/* Reports list */}
      {!isLoading && filteredReports.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredReports.map((report, i) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ delay: i * 0.04 }}
                layout
                className="glass p-5"
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-400" />
                    <span className="text-sm font-bold text-white">Report #{report.id}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                      report.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-green-500/10 text-green-400 border border-green-500/20'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">{formatDate(report.created_at)}</span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Reporter</p>
                    <p className="text-sm font-semibold text-white">{report.reporter_username || 'Anonymous'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Reported User</p>
                    <Link to={`/profile/${report.reported_username}`} className="text-sm font-semibold text-neon-cyan hover:underline">
                      {report.reported_username}
                    </Link>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Reason</p>
                    <p className="text-sm font-semibold text-white capitalize">{report.reason?.replace('_', ' ')}</p>
                  </div>
                  {report.post_id && (
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Post</p>
                      <Link to={`/post/${report.post_id}`} className="text-sm font-semibold text-neon-cyan hover:underline">#{report.post_id}</Link>
                    </div>
                  )}
                </div>

                {report.description && (
                  <div className="mb-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Description</p>
                    <p className="text-sm text-gray-300">{report.description}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Link to={`/profile/${report.reported_username}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/[0.04] border border-white/[0.06] rounded-lg text-gray-300 hover:bg-white/[0.06] transition">
                    <ExternalLink size={12} /> View Profile
                  </Link>
                  {report.post_id && (
                    <Link to={`/post/${report.post_id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/[0.04] border border-white/[0.06] rounded-lg text-gray-300 hover:bg-white/[0.06] transition">
                      <ExternalLink size={12} /> View Post
                    </Link>
                  )}
                  {report.status === 'pending' && (
                    <button
                      onClick={() => handleResolve(report.id)}
                      disabled={resolving === report.id}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg text-surface-dark ml-auto disabled:opacity-50 transition hover:shadow-neon-sm"
                      style={{ background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' }}
                    >
                      {resolving === report.id ? (
                        <><div className="w-3 h-3 border-2 border-surface-dark/30 border-t-surface-dark rounded-full animate-spin" /> Resolving...</>
                      ) : (
                        <><Check size={14} /> Mark Resolved</>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}