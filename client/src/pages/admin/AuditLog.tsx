import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Shield, Filter, RefreshCw, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar } from '../../components/ui/Avatar';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

interface AuditEntry {
  id: number; action: string; target_id: number | null;
  ip_address: string; created_at: string;
  admin_username: string; admin_avatar: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ban_user:             { label: 'Banned User',           color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  unban_user:           { label: 'Unbanned User',         color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  resolve_report:       { label: 'Resolved Report',       color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  approve_post:         { label: 'Approved Post',         color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
  delete_post:          { label: 'Deleted Post',          color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  force_password_reset: { label: 'Forced PW Reset',       color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
};

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filterAction, setFilterAction] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadAuditLog(); }, []);

  const loadAuditLog = async () => {
    setIsLoading(true);
    try { const data = await api.getAuditLog(); setEntries(data); }
    catch { toast.error('Failed to load audit log'); }
    finally { setIsLoading(false); }
  };

  const filteredEntries = filterAction === 'all' ? entries : entries.filter(e => e.action === filterAction);
  const uniqueActions = [...new Set(entries.map(e => e.action))];

  const exportCSV = () => {
    if (filteredEntries.length === 0) { toast.error('Nothing to export'); return; }
    const header = 'ID,Admin,Action,Target ID,IP Address,Timestamp\n';
    const rows = filteredEntries.map(e =>
      `${e.id},"${e.admin_username}","${ACTION_CONFIG[e.action]?.label || e.action}",${e.target_id || ''},${e.ip_address || ''},${new Date(e.created_at).toISOString()}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Audit Log</h1>
          <p className="text-xs text-gray-500 mt-1">Track all admin actions for accountability</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] transition">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={loadAuditLog} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] transition">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Filter size={14} className="text-gray-500 shrink-0" />
        <button
          onClick={() => setFilterAction('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
            filterAction === 'all'
              ? 'text-surface-dark border-transparent'
              : 'text-gray-400 bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06]'
          }`}
          style={filterAction === 'all' ? { background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' } : undefined}
        >
          All ({entries.length})
        </button>
        {uniqueActions.map(action => {
          const config = ACTION_CONFIG[action];
          return (
            <button
              key={action}
              onClick={() => setFilterAction(action)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                filterAction === action
                  ? `${config?.bg || 'bg-white/[0.08]'} ${config?.color || 'text-white'}`
                  : 'text-gray-400 bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06]'
              }`}
            >
              {config?.label || action} ({entries.filter(e => e.action === action).length})
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="glass overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 border-b border-white/[0.04]">
              <div className="w-7 h-7 rounded-full skeleton" /><div className="flex-1 space-y-1"><div className="h-3 w-40 skeleton rounded" /><div className="h-2 w-24 skeleton rounded" /></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filteredEntries.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-card flex items-center justify-center">
            <Shield className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No audit entries</p>
          <p className="text-gray-500 text-sm">Admin actions will appear here</p>
        </motion.div>
      )}

      {/* Table */}
      {!isLoading && filteredEntries.length > 0 && (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Admin</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Target</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">IP</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredEntries.map((entry, i) => {
                  const config = ACTION_CONFIG[entry.action];
                  return (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-white/[0.02] transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar src={entry.admin_avatar} alt={entry.admin_username} size="xs" />
                          <span className="text-sm font-medium text-white">{entry.admin_username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${config?.bg || 'bg-white/[0.06] border-white/[0.06]'} ${config?.color || 'text-gray-400'}`}>
                          {config?.label || entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{entry.target_id ? `#${entry.target_id}` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono hidden md:table-cell">{entry.ip_address || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(entry.created_at)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
