'use client'

import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import type { Track } from '@/lib/types'

interface TrackRowProps {
  track: Track
  index: number
  onRetry?: (id: string) => void
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const statusMap = {
  pending: { label: 'Pendente', variant: 'default' as const },
  searching: { label: 'Buscando', variant: 'processing' as const },
  downloading: { label: 'Baixando', variant: 'processing' as const },
  analyzing: { label: 'Analisando', variant: 'processing' as const },
  ready: { label: 'Pronta', variant: 'success' as const },
  error: { label: 'Erro', variant: 'error' as const },
}

export function TrackRow({ track, index, onRetry }: TrackRowProps) {
  const isError = track.status === 'error'
  const status = statusMap[track.status]

  return (
    <div
      className={`
        grid grid-cols-[2rem_2.5rem_1fr_5rem_4rem_4rem_6rem_5rem] items-center gap-3 px-4 py-3 rounded-lg
        transition-colors duration-150
        ${isError ? 'bg-red-500/5 border border-red-500/20' : 'hover:bg-zinc-800/50'}
      `}
    >
      <span className="text-xs tabular-nums text-zinc-500 text-right">{index + 1}</span>

      <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-zinc-800">
        {track.coverUrl ? (
          <img src={track.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-zinc-800" />
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-100">{track.title}</p>
        <p className="truncate text-xs text-zinc-500">{track.artist}</p>
      </div>

      <span className="text-xs tabular-nums text-zinc-400 text-right">
        {formatDuration(track.durationMs)}
      </span>

      <span className="text-xs tabular-nums text-zinc-300 text-center font-mono">
        {track.analysis?.bpm ?? '—'}
      </span>

      <span className="text-xs tabular-nums text-zinc-300 text-center font-mono">
        {track.analysis?.camelot ?? '—'}
      </span>

      <div className="flex items-center gap-2">
        {track.analysis ? (
          <>
            <ProgressBar
              value={track.analysis.energy * 100}
              color={track.analysis.energy > 0.7 ? 'amber' : 'emerald'}
              size="sm"
              className="flex-1"
            />
            <span className="text-xs tabular-nums text-zinc-500 w-7">
              {Math.round(track.analysis.energy * 100)}
            </span>
          </>
        ) : (
          <span className="text-xs text-zinc-600">—</span>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Badge variant={status.variant}>{status.label}</Badge>
        {isError && onRetry && (
          <button
            onClick={() => onRetry(track.id)}
            className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer"
          >
            Tentar
          </button>
        )}
      </div>
    </div>
  )
}
