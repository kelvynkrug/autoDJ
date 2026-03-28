'use client'

import { create } from 'zustand'
import type { Track } from '@/lib/types'

interface PlayerState {
  isPlaying: boolean
  currentTrackIndex: number
  tracks: Track[]
  volume: number
  /** ID do set atualmente carregado no player */
  activeSetId: string | null

  play: () => void
  pause: () => void
  skip: () => void
  setVolume: (v: number) => void
  setTracks: (tracks: Track[], setId?: string) => void
  setCurrentTrackIndex: (index: number) => void
  reset: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  isPlaying: false,
  currentTrackIndex: 0,
  tracks: [],
  volume: 0.8,
  activeSetId: null,

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  skip: () => {
    const { currentTrackIndex, tracks } = get()
    const nextIndex = currentTrackIndex + 1
    if (nextIndex < tracks.length) {
      set({ currentTrackIndex: nextIndex })
    } else {
      set({ isPlaying: false })
    }
  },

  setVolume: (v: number) => set({ volume: Math.max(0, Math.min(1, v)) }),

  setTracks: (tracks: Track[], setId?: string) =>
    set({ tracks, currentTrackIndex: 0, isPlaying: false, activeSetId: setId ?? null }),

  setCurrentTrackIndex: (index: number) => set({ currentTrackIndex: index }),

  reset: () => set({ isPlaying: false, currentTrackIndex: 0, tracks: [], activeSetId: null }),
}))
