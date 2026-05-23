interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  hasStory?: boolean;
  isOnline?: boolean;
}

export function Avatar({ src, alt = '', size = 'md', className = '', hasStory = false, isOnline }: AvatarProps) {
  const sizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24 md:w-36 md:h-36',
  };

  const onlineDotSizes = {
    xs: 'w-2 h-2 bottom-0 right-0',
    sm: 'w-2.5 h-2.5 bottom-0 right-0',
    md: 'w-3 h-3 bottom-0 right-0',
    lg: 'w-3.5 h-3.5 bottom-0.5 right-0.5',
    xl: 'w-4 h-4 bottom-1 right-1',
  };

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sizes[size]} rounded-full overflow-hidden ${
          hasStory
            ? 'ring-2 ring-neon-cyan ring-offset-2 ring-offset-surface-dark'
            : 'bg-surface-card'
        } ${className}`}
      >
        {src ? (
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-card text-neon-cyan font-bold text-sm">
            {alt?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>
      {isOnline && (
        <span
          className={`absolute ${onlineDotSizes[size]} rounded-full bg-neon-green border-2 border-surface-dark`}
          style={{ boxShadow: '0 0 8px rgba(57, 255, 20, 0.6)' }}
        />
      )}
    </div>
  );
}