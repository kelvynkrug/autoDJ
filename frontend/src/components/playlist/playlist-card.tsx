'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Playlist } from '@/lib/types'

interface PlaylistCardProps {
  playlist: Playlist
  showImport?: boolean
  onImport?: (id: string) => void
}

export function PlaylistCard({ playlist, showImport, onImport }: PlaylistCardProps) {
  const providerBadgeMap: Record<string, string> = { spotify: 'spotify', google: 'youtube', deezer: 'deezer' }
  const providerLabelMap: Record<string, string> = { spotify: 'Spotify', google: 'YouTube', deezer: 'Deezer' }
  const providerBadge = (playlist.provider && providerBadgeMap[playlist.provider]) ?? 'default'
  const providerLabel = (playlist.provider && providerLabelMap[playlist.provider]) ?? 'Criada'

  const content = (
    <div className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
        {playlist.coverUrl ? (
          <img
            src={playlist.coverUrl}
            alt={playlist.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-600">
            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
            </svg>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-100">{playlist.name}</p>
        <p className="text-sm text-zinc-400">{playlist.trackCount} faixas</p>
        <Badge variant={providerBadge as 'spotify' | 'youtube' | 'deezer' | 'default'} className="mt-1.5">
          {providerLabel}
        </Badge>
      </div>

      {showImport && onImport && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onImport(playlist.id)
          }}
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 cursor-pointer"
        >
          Importar
        </button>
      )}
    </div>
  )

  if (showImport) return content

  return (
    <Link href={`/playlists/${playlist.id}`}>
      {content}
    </Link>
  )
}
