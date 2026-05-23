import { Reply, Copy, Pencil, Trash2 } from 'lucide-react';
import type { Message } from '../../types';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

interface MessageContextMenuProps {
  message: Message;
  isOwn: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onReact: (emoji: string) => void;
}

export function MessageContextMenu({
  message, isOwn, position, onClose, onReply, onEdit, onDelete, onCopy, onReact,
}: MessageContextMenuProps) {
  const showReactions = true;

  const canEdit = isOwn && message.message_type === 'text' && !message.is_deleted &&
    (Date.now() - new Date(message.created_at).getTime()) < 15 * 60 * 1000;

  const canDelete = isOwn && !message.is_deleted;

  // Compute position to stay within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 220),
    top: Math.min(position.y, window.innerHeight - 300),
    zIndex: 100,
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[99]" onClick={onClose} />

      <div style={style} className="z-[100] w-52 glass shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
        {/* Quick reactions row */}
        {showReactions && !message.is_deleted && (
          <div className="flex items-center gap-0.5 p-2 border-b border-white/[0.06]">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { onReact(emoji); onClose(); }}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/[0.08] rounded-lg transition hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="py-1">
          {!message.is_deleted && (
            <button
              onClick={() => { onReply(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] transition"
            >
              <Reply size={16} className="text-gray-400" /> Reply
            </button>
          )}

          {message.message_type === 'text' && !message.is_deleted && (
            <button
              onClick={() => { onCopy(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] transition"
            >
              <Copy size={16} className="text-gray-400" /> Copy
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => { onEdit(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] transition"
            >
              <Pencil size={16} className="text-gray-400" /> Edit
            </button>
          )}

          {canDelete && (
            <button
              onClick={() => { onDelete(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      </div>
    </>
  );
}
