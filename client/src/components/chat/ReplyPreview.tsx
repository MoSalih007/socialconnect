import type { ReplyPreview as ReplyPreviewType } from '../../types';
import { X } from 'lucide-react';

interface ReplyPreviewProps {
  reply: ReplyPreviewType;
  senderName?: string;
  isInput?: boolean;       // true = shown above the input bar
  onClear?: () => void;    // only for input variant
}

export function ReplyPreview({ reply, senderName, isInput, onClear }: ReplyPreviewProps) {
  const getPreviewText = () => {
    if (reply.is_deleted) return 'This message was deleted';
    if (reply.message_type === 'image') return '📷 Photo';
    if (reply.message_type === 'voice') return '🎤 Voice message';
    if (reply.message_type === 'gif') return 'GIF';
    if (reply.message_type === 'sticker') return '🎨 Sticker';
    return reply.content.length > 80 ? reply.content.slice(0, 80) + '...' : reply.content;
  };

  if (isInput) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 mb-1 bg-white/[0.03] border-l-2 border-l-neon-cyan rounded-r-lg">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-neon-cyan truncate">
            {senderName || `User #${reply.sender_id}`}
          </p>
          <p className="text-xs text-gray-400 truncate">{getPreviewText()}</p>
        </div>
        {onClear && (
          <button onClick={onClear} className="p-1 hover:bg-white/[0.06] rounded-full transition">
            <X size={14} className="text-gray-400" />
          </button>
        )}
      </div>
    );
  }

  // In-bubble variant (shown inside a message bubble)
  return (
    <div className="px-3 py-1.5 mb-1 bg-white/[0.04] border-l-2 border-l-gray-500/40 rounded-r-md">
      <p className="text-[10px] font-semibold text-gray-400 truncate">
        {reply.sender_username || senderName || `User #${reply.sender_id}`}
      </p>
      <p className="text-[11px] text-gray-500 truncate">{getPreviewText()}</p>
    </div>
  );
}
