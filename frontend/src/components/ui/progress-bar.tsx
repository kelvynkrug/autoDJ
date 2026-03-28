interface ProgressBarProps {
  value: number
  max?: number
  color?: 'violet' | 'emerald' | 'amber' | 'red'
  size?: 'sm' | 'md'
  className?: string
  animated?: boolean
}

const colorClasses = {
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

export function ProgressBar({
  value,
  max = 100,
  color = 'violet',
  size = 'md',
  className = '',
  animated = false,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div
      className={`
        w-full overflow-hidden rounded-full bg-zinc-800
        ${size === 'sm' ? 'h-1.5' : 'h-2.5'}
        ${className}
      `}
    >
      <div
        className={`
          h-full rounded-full transition-all duration-500 ease-out
          ${colorClasses[color]}
          ${animated ? 'animate-pulse' : ''}
        `}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
