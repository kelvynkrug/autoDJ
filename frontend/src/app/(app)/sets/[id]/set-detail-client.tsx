'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { CompatibilityIndicator } from '@/components/playlist/compatibility-indicator'
import type { DJSet, TransitionType, SetTrack } from '@/lib/types'

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const transitionOptions: { value: TransitionType; label: string }[] = [
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'eq_swap', label: 'EQ Swap' },
  { value: 'filter_sweep', label: 'Filter Sweep' },
]

function SetTrackRow({ track, index, total }: { track: SetTrack; index: number; total: number }) {
  return (
    <div>
      <div className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-zinc-800/50 transition-colors group">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-xs tabular-nums text-zinc-500 group-hover:bg-violet-600/20 group-hover:text-violet-400 transition-colors">
          {track.position}
        </div>

        <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
          {track.coverUrl ? (
            <img src={track.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-zinc-800" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-100">{track.title}</p>
          <p className="truncate text-xs text-zinc-500">{track.artist}</p>
        </div>

        <span className="text-xs tabular-nums text-zinc-400 font-mono">
          {track.analysis?.bpm ?? track.bpmAdjusted} BPM
        </span>

        <Badge variant="default" className="font-mono text-xs">
          {track.analysis?.camelot ?? '—'}
        </Badge>

        <div className="w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500"
            style={{ width: `${(track.analysis?.energy ?? 0.5) * 100}%` }}
          />
        </div>

        <span className="text-xs tabular-nums text-zinc-400">
          {formatDuration(track.durationMs)}
        </span>

        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 cursor-pointer">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
          </svg>
        </button>
      </div>

      {index < total - 1 && (
        <div className="ml-12 mr-4">
          <CompatibilityIndicator score={track.compatibilityScore} />
        </div>
      )}
    </div>
  )
}

export function SetDetailClient({ set }: { set: DJSet }) {
  const [name, setName] = useState(set.name)
  const [transitionType, setTransitionType] = useState<TransitionType>(set.transitionType)
  const [transitionBeats, setTransitionBeats] = useState(set.transitionBeats)

  return (
    <div className="space-y-6">
      <Link
        href="/sets"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Voltar para Sets
      </Link>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nome do Set</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-lg font-semibold text-zinc-100 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tipo de Transicao</label>
            <select
              value={transitionType}
              onChange={(e) => setTransitionType(e.target.value as TransitionType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors cursor-pointer appearance-none"
            >
              {transitionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <Slider
            value={transitionBeats}
            min={4}
            max={32}
            step={4}
            onChange={setTransitionBeats}
            label="Duracao da Transicao (beats)"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-4.5L16.5 16.5m0 0L12 12m4.5 4.5V3" />
          </svg>
          Ordenar automaticamente
        </Button>
        <Link href={`/sets/${set.id}/player`}>
          <Button variant="primary" size="lg">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Iniciar Set
          </Button>
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-zinc-200">
            Faixas ({set.tracks.length})
          </h2>
          <p className="text-sm text-zinc-500">Arraste para reordenar</p>
        </div>

        {set.tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-12">
            <p className="text-zinc-400">Nenhuma faixa neste set</p>
            <p className="mt-1 text-sm text-zinc-600">Adicione faixas a partir de uma playlist.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {set.tracks.map((track, i) => (
              <SetTrackRow
                key={track.id}
                track={track}
                index={i}
                total={set.tracks.length}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
