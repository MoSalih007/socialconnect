import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { pageVariants } from '../lib/animations';

export function BlockedUsers() {
  const [blocked, setBlocked] = useState([]);

  useEffect(() => { loadBlocked(); }, []);

  const loadBlocked = async () => {
    try { const data = await api.getBlockedUsers(); setBlocked(data); }
    catch { console.error('Failed to load'); }
  };

  const handleUnblock = async (userId: number) => {
    try { await api.unblockUser(userId); setBlocked(blocked.filter((u: any) => u.id !== userId)); }
    catch { alert('Unblock failed'); }
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-white mb-6">Blocked Users</h1>
      {blocked.length === 0 ? (
        <p className="text-center text-gray-500">No blocked users</p>
      ) : (
        <div className="space-y-3">
          {blocked.map((user: any) => (
            <div key={user.id} className="flex items-center justify-between p-4 glass">
              <div className="flex items-center gap-3">
                <Avatar src={user.avatar_url} />
                <div>
                  <p className="font-semibold text-white">{user.username}</p>
                  <p className="text-sm text-gray-500">{user.full_name}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => handleUnblock(user.id)}>Unblock</Button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}