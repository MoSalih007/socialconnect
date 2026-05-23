import { useState } from 'react';
import { X } from 'lucide-react';

interface StickerPickerProps {
    onSelect: (sticker: string) => void;
    onClose: () => void;
}

// Built-in sticker/emoji categories
// You can customize these or add your own image-based stickers later!
const STICKER_CATEGORIES = [
    {
        name: '😊',
        label: 'Smileys',
        stickers: [
            '😀', '😃', '😄', '😁', '😆', '🤣', '😂', '🙂', '😊', '😇',
            '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪',
            '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐',
            '😑', '😶', '🫠', '😏', '😒', '🙄', '😬', '🤥', '🫨', '😌',
            '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥴',
            '😵', '🤯', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟',
        ],
    },
    {
        name: '❤️',
        label: 'Love',
        stickers: [
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
            '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
            '😍', '🥰', '😘', '😻', '💋', '💌', '🫶', '🤗', '💑', '👩‍❤️‍👨',
        ],
    },
    {
        name: '👋',
        label: 'Gestures',
        stickers: [
            '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌',
            '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉',
            '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛',
            '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '💪', '🦾',
        ],
    },
    {
        name: '🐱',
        label: 'Animals',
        stickers: [
            '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
            '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
            '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
            '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🪲', '🐢',
        ],
    },
    {
        name: '🍕',
        label: 'Food',
        stickers: [
            '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒',
            '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍕', '🍔', '🍟', '🌭',
            '🍿', '🧁', '🍰', '🎂', '🍦', '🍩', '🍪', '☕', '🧋', '🍺',
        ],
    },
    {
        name: '⚡',
        label: 'Symbols',
        stickers: [
            '⭐', '🌟', '✨', '💫', '⚡', '🔥', '💥', '❄️', '🌪️', '🌈',
            '☀️', '🌙', '⭕', '❌', '✅', '❓', '❗', '💯', '🆒', '🆕',
            '🎵', '🎶', '🔔', '📢', '💬', '💭', '🗯️', '🏆', '🎯', '🎪',
        ],
    },
];

export function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
    const [activeCategory, setActiveCategory] = useState(0);
    const currentCategory = STICKER_CATEGORIES[activeCategory];

    return (
        <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50"
            style={{ height: '350px' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-lg font-bold">Stickers</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Category Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-2">
                {STICKER_CATEGORIES.map((cat, index) => (
                    <button
                        key={cat.label}
                        type="button"
                        onClick={() => setActiveCategory(index)}
                        className={`flex-1 py-2 text-center text-lg transition relative ${activeCategory === index
                            ? 'opacity-100'
                            : 'opacity-50 hover:opacity-75'
                            }`}
                        title={cat.label}
                    >
                        {cat.name}
                        {activeCategory === index && (
                            <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary-500 rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Stickers Grid */}
            <div className="overflow-y-auto p-3" style={{ height: 'calc(100% - 105px)' }}>
                <div className="grid grid-cols-6 gap-1">
                    {currentCategory.stickers.map((sticker, index) => (
                        <button
                            key={`${currentCategory.label}-${index}`}
                            type="button"
                            onClick={() => onSelect(sticker)}
                            className="p-2 text-2xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition hover:scale-125 active:scale-95 transform"
                            title={`Send ${sticker}`}
                        >
                            {sticker}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
