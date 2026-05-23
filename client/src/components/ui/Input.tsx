import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-gray-400">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-3 bg-black/40 border rounded-xl text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 transition-all duration-300',
            error
              ? 'border-red-500/50 focus:ring-red-500/30'
              : 'border-white/10 focus:ring-neon-cyan/30 focus:border-neon-cyan/30',
            className
          )}
          style={!error ? { boxShadow: 'none' } : undefined}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 209, 0.08)';
            }
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
            props.onBlur?.(e);
          }}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }
);