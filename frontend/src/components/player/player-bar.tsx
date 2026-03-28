'use client'

import { useState } from 'react'
import { NowPlaying } from './now-playing'
import { PlayerControls } from './player-controls'
import { VolumeControl } from './volume-control'
import { TrackProgress } from './track-progress'
import type { Track } from '@/lib/types'

interface PlayerBarProps {
  track: Track | null
}

export function PlayerBar({ track }: PlayerBarProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  if (!track) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-xl">
      <TrackProgress
        durationMs={track.durationMs}
        isPlaying={isPlaying}
        className="px-4 pt-2"
      />
      <div className="flex items-center justify-between px-4 py-2">
        <NowPlaying track={track} size="sm" />
        <PlayerControls
          isPlaying={isPlaying}
          onToggle={() => setIsPlaying(!isPlaying)}
          onSkip={() => {}}
        />
        <VolumeControl className="hidden md:flex" />
      </div>
    </div>
  )
}
