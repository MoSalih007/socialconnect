import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { pageVariants } from '../lib/animations';
import toast from 'react-hot-toast';

export function FollowRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try { const data = await api.getFollowRequests(); setRequests(data); }
    catch { toast.error('Failed to load requests'); }
    finally { setIsLoading(false); }
  };

  const handleAccept = async (requestId: number) => {
    try { await api.acceptFollowRequest(requestId); setRequests(requests.filter(r => r.id !== requestId)); toast.success('Follow request accepted'); }
    catch { toast.error('Failed to accept request'); }
  };

  const handleReject = async (requestId: number) => {
    try { await api.rejectFollowRequest(requestId); setRequests(requests.filter(r => r.id !== requestId)); toast.success('Request declined'); }
    catch { toast.error('Failed to reject request'); }
  };

  if (isLoading) return <div className="text-center py-8 text-gray-400">Loading requests...</div>;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-white mb-6">Follow Requests</h1>
      {requests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No pending follow requests</div>
      ) : (
        <div className="space-y-3">
          {requests.map((request: any) => (
            <div key={request.id} className="flex items-center justify-between p-4 glass">
              <div className="flex items-center gap-3">
                <img src={request.avatar_url || '/default-avatar.png'} alt={request.username} className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-white">{request.username}</p>
                  {request.full_name && <p className="text-sm text-gray-500">{request.full_name}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAccept(request.id)}
                  className="p-2 rounded-xl transition-all text-surface-dark hover:shadow-neon-sm"
                  style={{ background: 'linear-gradient(135deg, #00FFD1, #00d4ff)' }}>
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => handleReject(request.id)}
                  className="p-2 bg-white/[0.06] rounded-xl hover:bg-white/[0.1] text-gray-400 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}