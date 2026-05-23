import { Avatar } from '../ui/Avatar';

interface GroupAvatarProps {
  members?: { avatar_url?: string; username: string }[];
  avatarUrl?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export function GroupAvatar({ members, avatarUrl, name, size = 'md' }: GroupAvatarProps) {
  // If group has a custom avatar, use it
  if (avatarUrl) {
    return <Avatar src={avatarUrl} alt={name} size={size} />;
  }

  // Multi-avatar stack (show up to 3 member avatars)
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16' };
  const innerSizes = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-9 h-9' };
  const textSizes = { sm: 'text-[8px]', md: 'text-[9px]', lg: 'text-xs' };

  const displayMembers = (members || []).slice(0, 3);

  if (displayMembers.length === 0) {
    // Fallback: colored circle with initials
    return (
      <div className={`${sizes[size]} rounded-full flex items-center justify-center flex-shrink-0`}
        style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #00d4ff 100%)' }}>
        <span className={`font-bold text-surface-dark ${textSizes[size]}`}>
          {name.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  if (displayMembers.length === 1) {
    return <Avatar src={displayMembers[0].avatar_url} alt={name} size={size} />;
  }

  // 2-3 member overlap layout
  return (
    <div className={`${sizes[size]} relative flex-shrink-0`}>
      {displayMembers.slice(0, 2).map((m, i) => (
        <div
          key={i}
          className={`absolute ${innerSizes[size]} rounded-full overflow-hidden border-2 border-surface-dark`}
          style={{
            top: i === 0 ? '0' : 'auto',
            bottom: i === 1 ? '0' : 'auto',
            left: i === 0 ? '0' : 'auto',
            right: i === 1 ? '0' : 'auto',
          }}
        >
          {m.avatar_url ? (
            <img src={m.avatar_url} alt={m.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-card text-neon-cyan font-bold text-[8px]">
              {m.username[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
      ))}
      {displayMembers.length > 2 && (
        <div
          className={`absolute bottom-0 right-0 ${innerSizes[size]} rounded-full bg-surface border-2 border-surface-dark flex items-center justify-center`}
        >
          <span className="text-[8px] font-bold text-gray-400">+{(members?.length || 3) - 2}</span>
        </div>
      )}
    </div>
  );
}
