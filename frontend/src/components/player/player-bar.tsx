'use client'

import { useCallback } from 'react'
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

  if (!track || !isEngineInitialized()) return null

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
          onToggle={handleToggle}
          onSkip={handleSkip}
        />
        <VolumeControl
          volume={volume}
          onVolumeChange={(v) => setStoreVolume(v)}
          className="hidden md:flex"
        />
      </div>
    </div>
  )
}
