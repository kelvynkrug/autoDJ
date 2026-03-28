'use client'

import { useEffect, useRef, useCallback } from 'react'
import { AudioEngine } from '@/lib/audio/engine'
import { usePlayerStore } from '@/lib/stores/player-store'

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null)

  const { isPlaying, volume, currentTrackIndex, tracks, setCurrentTrackIndex, pause } =
    usePlayerStore()

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine()
    }
    return engineRef.current
  }, [])

  useEffect(() => {
    return () => {
      engineRef.current?.destroy()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setVolume(volume)
  }, [volume])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return

    engine.onTrackChange = (index) => {
      setCurrentTrackIndex(index)
    }

    engine.onSetEnd = () => {
      pause()
    }
  }, [setCurrentTrackIndex, pause])

  return {
    getEngine,
    engineRef,
  }
}
