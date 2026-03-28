'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NowPlaying } from '@/components/player/now-playing'
import { PlayerControls } from '@/components/player/player-controls'
import { VolumeControl } from '@/components/player/volume-control'
import { TrackProgress } from '@/components/player/track-progress'
import type { DJSet } from '@/lib/types'

export function PlayerClient({ set }: { set: DJSet }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  const currentTrack = set.tracks[currentIndex]
  const nextTrack = set.tracks[currentIndex + 1]

  const handleSkip = () => {
    if (currentIndex < set.tracks.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  if (!currentTrack) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">Este set nao possui faixas.</p>
          <Link
            href={`/sets/${set.id}`}
            className="mt-4 inline-flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            Voltar para Set
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col lg:flex-row gap-6">
      <div className="flex flex-1 flex-col items-center justify-center">
        <Link
          href={`/sets/${set.id}`}
          className="self-start inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-8"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Voltar para Set
        </Link>

        <div className="w-full max-w-md space-y-8">
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-zinc-800 shadow-2xl shadow-black/50">
            {currentTrack.coverUrl ? (
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className={`h-full w-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-600">
                <svg className="h-24 w-24" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            )}
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-100">{currentTrack.title}</h1>
            <p className="mt-1 text-zinc-400">{currentTrack.artist}</p>
            <div className="mt-3 flex items-center justify-center gap-3 text-xs text-zinc-500">
              <span className="font-mono">{currentTrack.analysis?.bpm ?? currentTrack.bpmAdjusted} BPM</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="font-mono">{currentTrack.analysis?.camelot ?? '—'}</span>
            </div>
          </div>

          <TrackProgress
            durationMs={currentTrack.durationMs}
            isPlaying={isPlaying}
          />

          <div className="flex items-center justify-center gap-6">
            <VolumeControl />
            <PlayerControls
              isPlaying={isPlaying}
              onToggle={() => setIsPlaying(!isPlaying)}
              onSkip={handleSkip}
              size="lg"
            />
          </div>

          {isPlaying && (
            <div className="mx-auto w-fit rounded-full bg-violet-600/10 px-4 py-2 text-center">
              <p className="text-xs text-violet-400">
                Transicao em <span className="font-mono font-bold">32</span> segundos
              </p>
            </div>
          )}

          {nextTrack && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500 mb-2">Proxima faixa</p>
              <NowPlaying track={nextTrack} size="sm" />
            </div>
          )}
        </div>
      </div>

      <div className="lg:w-80 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-4 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">
          {set.name} — {set.tracks.length} faixas
        </h3>
        <div className="space-y-1">
          {set.tracks.map((track, i) => {
            const isCurrent = i === currentIndex
            return (
              <button
                key={track.id}
                onClick={() => setCurrentIndex(i)}
                className={`
                  w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all cursor-pointer
                  ${isCurrent ? 'bg-violet-600/15 border border-violet-500/30' : 'hover:bg-zinc-800/60 border border-transparent'}
                `}
              >
                <span className={`text-xs tabular-nums w-5 text-right ${isCurrent ? 'text-violet-400' : 'text-zinc-600'}`}>
                  {i + 1}
                </span>
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-zinc-800">
                  {track.coverUrl ? (
                    <img src={track.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-zinc-800" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${isCurrent ? 'font-medium text-violet-300' : 'text-zinc-300'}`}>
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-zinc-600">{track.artist}</p>
                </div>
                {isCurrent && isPlaying && (
                  <div className="flex items-end gap-0.5 h-3">
                    <div className="w-0.5 h-full bg-violet-500 animate-pulse rounded-full" />
                    <div className="w-0.5 h-2/3 bg-violet-500 animate-pulse rounded-full" style={{ animationDelay: '0.15s' }} />
                    <div className="w-0.5 h-full bg-violet-500 animate-pulse rounded-full" style={{ animationDelay: '0.3s' }} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
