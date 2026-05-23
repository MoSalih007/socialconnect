import { useState, useRef, useEffect } from 'react';
import { SmilePlus } from 'lucide-react';
import type { MessageReaction } from '../../types';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥', '🎉', '💯'];

interface MessageReactionsProps {
  reactions: MessageReaction[];
  currentUserId: number;
  onAdd: (emoji: string) => void;
  onRemove: (emoji: string) => void;
}

export function MessageReactions({ reactions, currentUserId, onAdd, onRemove }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  // Group reactions by emoji
  const grouped: Record<string, { emoji: string; users: { user_id: number; username: string }[]; hasOwn: boolean }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { emoji: r.emoji, users: [], hasOwn: false };
    }
    grouped[r.emoji].users.push({ user_id: r.user_id, username: r.username });
    if (r.user_id === currentUserId) {
      grouped[r.emoji].hasOwn = true;
    }
  }

  const groups = Object.values(grouped);
  if (groups.length === 0 && !showPicker) return null;

  return (
    <div className="flex items-center gap-1 mt-0.5 flex-wrap relative">
      {groups.map((g) => (
        <button
          key={g.emoji}
          onClick={() => g.hasOwn ? onRemove(g.emoji) : onAdd(g.emoji)}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-all ${
            g.hasOwn
              ? 'bg-neon-cyan/15 border border-neon-cyan/30 text-neon-cyan'
              : 'bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:bg-white/[0.08]'
          }`}
          title={g.users.map(u => u.username).join(', ')}
        >
          <span>{g.emoji}</span>
          <span className="font-medium">{g.users.length}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="p-1 rounded-full hover:bg-white/[0.06] transition text-gray-500 hover:text-gray-300"
          title="Add reaction"
        >
          <SmilePlus size={14} />
        </button>

        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 bg-surface-card border border-white/[0.08] rounded-xl shadow-lg p-1.5 flex gap-0.5 z-50">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { onAdd(emoji); setShowPicker(false); }}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/[0.08] rounded-lg transition hover:scale-110"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
