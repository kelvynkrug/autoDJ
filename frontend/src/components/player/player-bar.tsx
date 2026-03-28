'use client'

import { useCallback, useEffect, useState } from 'react'
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
    setCurrentTrackIndex,
    setVolume: setStoreVolume,
  } = usePlayerStore()

  const [currentTimeMs, setCurrentTimeMs] = useState(0)

  const track = tracks[currentTrackIndex]

  // Registra callbacks do engine como fallback quando player-client nao esta montado
  useEffect(() => {
    if (!isEngineInitialized()) return

    const engine = getOrCreateEngine()

    // Salva referencia anterior para nao sobrescrever se player-client ja registrou
    const prevOnTrackChange = engine.onTrackChange
    const prevOnSetEnd = engine.onSetEnd

    engine.onTrackChange = (engineIndex, engineTrack) => {
      const setIdx = tracks.findIndex((t) => t.id === engineTrack.id)
      setCurrentTrackIndex(setIdx >= 0 ? setIdx : engineIndex)
      setCurrentTimeMs(0)
    }

    engine.onSetEnd = () => {
      storePause()
    }

    return () => {
      // Restaura callbacks anteriores se o engine ainda existir
      if (isEngineInitialized()) {
        const eng = getOrCreateEngine()
        // So restaura se nos somos quem registrou
        if (eng.onTrackChange === engine.onTrackChange) {
          eng.onTrackChange = prevOnTrackChange
        }
        if (eng.onSetEnd === engine.onSetEnd) {
          eng.onSetEnd = prevOnSetEnd
        }
      }
    }
  }, [tracks, setCurrentTrackIndex, storePause])

  // Polling do tempo para progress bar
  useEffect(() => {
    if (!isPlaying || !isEngineInitialized()) return

    const interval = setInterval(() => {
      const engine = getOrCreateEngine()
      const currentSeconds = engine.getCurrentTime()
      setCurrentTimeMs(Math.floor(currentSeconds * 1000))
    }, 250)

    return () => clearInterval(interval)
  }, [isPlaying])

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
        key={track.id}
        durationMs={track.durationMs}
        isPlaying={isPlaying}
        currentMs={currentTimeMs}
        onSeek={(ms) => {
          if (!isEngineInitialized()) return
          const engine = getOrCreateEngine()
          engine.seek(ms / 1000)
          setCurrentTimeMs(ms)
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
