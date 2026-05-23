import { useState } from 'react';

const CATEGORIES: Record<string, string[]> = {
  '😀 Smileys': [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊',
    '😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋',
    '😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔',
    '🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄',
    '😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕',
    '🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸',
    '😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲',
    '😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭',
    '😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡',
    '😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺',
  ],
  '❤️ Hearts': [
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
    '❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝',
    '💟','♥️','💋','💌','💐','🌹','🥀','🫶',
  ],
  '👋 Hands': [
    '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌',
    '🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉',
    '👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛',
    '🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💪',
  ],
  '🐶 Animals': [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨',
    '🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒',
    '🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗',
    '🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰',
  ],
  '🍕 Food': [
    '🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈',
    '🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🫛',
    '🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅',
    '🍕','🍔','🍟','🌭','🍿','🧂','🥚','🍳','🧇','🥞',
  ],
  '⚽ Activities': [
    '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱',
    '🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳',
    '🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷',
  ],
  '🎵 Symbols': [
    '🎵','🎶','🎤','🎧','📱','💻','⌨️','🖥️','🖨️','🖱️',
    '💡','🔦','🕯️','📦','💰','💳','✉️','📧','📮','🏷️',
    '⭐','🌟','💫','✨','🔥','💥','❄️','🌈','☀️','🌙',
    '⚡','💧','🌊','🎉','🎊','🎈','🎁','🏆','🏅','🥇',
    '✅','❌','⭕','❗','❓','💯','🔝','🔜','🆕','🆒',
  ],
};

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const categoryKeys = Object.keys(CATEGORIES);
  const [activeCategory, setActiveCategory] = useState(categoryKeys[0]);

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50"
      style={{ maxHeight: '320px' }}
    >
      {/* Category tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-1 pt-1 overflow-x-auto scrollbar-thin">
        {categoryKeys.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-2 text-lg shrink-0 rounded-t-lg transition-colors ${
              activeCategory === cat
                ? 'bg-gray-100 dark:bg-gray-800'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
            title={cat}
          >
            {cat.split(' ')[0]}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto px-2.5 py-2 text-sm text-gray-400 hover:text-gray-600 shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Emoji grid */}
      <div className="p-2 overflow-y-auto" style={{ maxHeight: '250px' }}>
        <div className="grid grid-cols-8 gap-0.5">
          {CATEGORIES[activeCategory].map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => onSelect(emoji)}
              className="w-9 h-9 flex items-center justify-center text-xl hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
