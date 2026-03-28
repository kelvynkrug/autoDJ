'use client'

interface PlayerControlsProps {
  isPlaying: boolean
  onToggle: () => void
  onSkip: () => void
  size?: 'sm' | 'lg'
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

function SkipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  )
}

export function PlayerControls({ isPlaying, onToggle, onSkip, size = 'sm' }: PlayerControlsProps) {
  const btnSize = size === 'lg' ? 'h-14 w-14' : 'h-9 w-9'
  const iconSize = size === 'lg' ? 'h-7 w-7' : 'h-4 w-4'
  const skipBtnSize = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  const skipIconSize = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        className={`
          ${btnSize} flex items-center justify-center rounded-full
          bg-violet-600 text-white hover:bg-violet-500 active:bg-violet-700
          transition-all duration-150 shadow-lg shadow-violet-500/20 cursor-pointer
        `}
      >
        {isPlaying ? (
          <PauseIcon className={iconSize} />
        ) : (
          <PlayIcon className={iconSize} />
        )}
      </button>
      <button
        onClick={onSkip}
        className={`
          ${skipBtnSize} flex items-center justify-center rounded-full
          text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
          transition-all duration-150 cursor-pointer
        `}
      >
        <SkipIcon className={skipIconSize} />
      </button>
    </div>
  )
}
