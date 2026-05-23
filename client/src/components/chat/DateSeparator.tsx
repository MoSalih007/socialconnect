interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDate.getTime() === today.getTime()) return 'Today';
    if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';

    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    });
  };

  return (
    <div className="flex items-center gap-4 my-4">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 select-none">
        {formatDateLabel(date)}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}
