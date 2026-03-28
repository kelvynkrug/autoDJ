import type { Track } from '@/lib/types'

interface NowPlayingProps {
  track: Track
  size?: 'sm' | 'lg'
}

export function NowPlaying({ track, size = 'sm' }: NowPlayingProps) {
  const imgSize = size === 'sm' ? 'h-10 w-10' : 'h-20 w-20'

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className={`${imgSize} shrink-0 overflow-hidden rounded-md bg-zinc-800`}>
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={track.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-600">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className={`truncate font-medium text-zinc-100 ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>
          {track.title}
        </p>
        <p className={`truncate text-zinc-400 ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
          {track.artist}
        </p>
      </div>
    </div>
  )
}
