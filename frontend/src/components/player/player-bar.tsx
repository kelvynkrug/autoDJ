'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { NowPlaying } from './now-playing'
import { PlayerControls } from './player-controls'
import { VolumeControl } from './volume-control'
import { TrackProgress } from './track-progress'
import { usePlayerStore } from '@/lib/stores/player-store'
import {
  getOrCreateEngine,
  isEngineInitialized,
} from '@/lib/audio/singleton'

export function PlayerBar() {
  const {
    isPlaying,
    currentTrackIndex,
    tracks,
    volume,
    play: storePlay,
    pause: storePause,
    setVolume: setStoreVolume,
  } = usePlayerStore()

  const track = tracks[currentTrackIndex]

  const handleToggle = useCallback(async () => {
    if (!isEngineInitialized()) return

    const engine = getOrCreateEngine()

    if (isPlaying) {
      engine.pause()
      storePause()
    } else {
      await engine.play()
      storePlay()
    }
  }, [isPlaying, storePlay, storePause])

  const handleSkip = useCallback(async () => {
    if (!isEngineInitialized()) return

    const engine = getOrCreateEngine()
    await engine.skip()
  }, [])

  const activeSetId = usePlayerStore((s) => s.activeSetId)

  if (!track || !isEngineInitialized()) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-xl">
      <TrackProgress
        durationMs={track.durationMs}
        isPlaying={isPlaying}
        onSeek={(ms) => {
          if (!isEngineInitialized()) return
          const engine = getOrCreateEngine()
          engine.seek(ms / 1000)
        }}
        className="px-4 pt-2"
      />
      <div className="flex items-center justify-between px-4 py-2">
        <NowPlaying track={track} size="sm" />
        <div className="flex items-center gap-3">
          <PlayerControls
            isPlaying={isPlaying}
            onToggle={handleToggle}
            onSkip={handleSkip}
          />
          {activeSetId && (
            <Link
              href={`/sets/${activeSetId}/player`}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors"
            >
              Mixer
            </Link>
          )}
        </div>
        <VolumeControl
          volume={volume}
          onVolumeChange={(v) => {
            setStoreVolume(v)
            if (isEngineInitialized()) {
              getOrCreateEngine().setVolume(v)
            }
          }}
          className="hidden md:flex"
        />
      </div>
    </div>
  )
}
