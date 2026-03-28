'use client'

import { create } from 'zustand'
import type { Track } from '@/lib/types'

interface PlayerState {
  isPlaying: boolean
  currentTrackIndex: number
  tracks: Track[]
  volume: number

  play: () => void
  pause: () => void
  skip: () => void
  setVolume: (v: number) => void
  setTracks: (tracks: Track[]) => void
  setCurrentTrackIndex: (index: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  isPlaying: false,
  currentTrackIndex: 0,
  tracks: [],
  volume: 0.8,

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

  setTracks: (tracks: Track[]) =>
    set({ tracks, currentTrackIndex: 0, isPlaying: false }),

  setCurrentTrackIndex: (index: number) => set({ currentTrackIndex: index }),
}))
