'use client'

import { useEffect, useCallback } from 'react'
import { usePlayerStore } from '@/lib/stores/player-store'
import {
  getOrCreateEngine,
  isEngineInitialized,
} from '@/lib/audio/singleton'

export function useAudioEngine() {
  const { isPlaying, volume, setCurrentTrackIndex, pause } =
    usePlayerStore()

  const getEngine = useCallback(() => {
    return getOrCreateEngine()
  }, [])

  useEffect(() => {
    if (!isEngineInitialized()) return
    const engine = getOrCreateEngine()
    engine.setVolume(volume)
  }, [volume])

  useEffect(() => {
    if (!isEngineInitialized()) return
    const engine = getOrCreateEngine()

    engine.onTrackChange = (index) => {
      setCurrentTrackIndex(index)
    }

    engine.onSetEnd = () => {
      pause()
    }
  }, [setCurrentTrackIndex, pause])

  return {
    getEngine,
  }
}
