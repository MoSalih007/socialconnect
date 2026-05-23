export function TypingIndicator({ name }: { name?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-surface border border-white/[0.04]">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      {name && (
        <span className="text-[10px] text-gray-500 font-medium">{name} is typing...</span>
      )}
    </div>
  );
}
