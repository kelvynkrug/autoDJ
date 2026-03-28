import type { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'spotify' | 'youtube' | 'deezer' | 'success' | 'warning' | 'error' | 'processing'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-zinc-800 text-zinc-300',
  spotify: 'bg-[#1DB954]/15 text-[#1DB954]',
  youtube: 'bg-[#FF0000]/15 text-[#FF4444]',
  deezer: 'bg-[#A238FF]/15 text-[#A238FF]',
  success: 'bg-emerald-500/15 text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-400',
  error: 'bg-red-500/15 text-red-400',
  processing: 'bg-violet-500/15 text-violet-400',
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium
        ${variantClasses[variant]} ${className}
      `}
      {...props}
    >
      {variant === 'processing' && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
      )}
      {children}
    </span>
  )
}
