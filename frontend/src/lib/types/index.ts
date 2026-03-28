export type Provider = 'spotify' | 'google'

export type TrackStatus =
  | 'pending'
  | 'searching'
  | 'downloading'
  | 'analyzing'
  | 'ready'
  | 'error'

export type SetStatus = 'draft' | 'ready' | 'playing' | 'paused' | 'finished'

export type TransitionType = 'crossfade' | 'eq_swap' | 'filter_sweep'

export type CamelotKey =
  | '1A' | '1B'
  | '2A' | '2B'
  | '3A' | '3B'
  | '4A' | '4B'
  | '5A' | '5B'
  | '6A' | '6B'
  | '7A' | '7B'
  | '8A' | '8B'
  | '9A' | '9B'
  | '10A' | '10B'
  | '11A' | '11B'
  | '12A' | '12B'

export interface TrackAnalysis {
  bpm: number
  camelot: CamelotKey
  energy: number
  danceability: number
}

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  durationMs: number
  coverUrl: string | null
  status: TrackStatus
  analysis?: TrackAnalysis
}

export interface Playlist {
  id: string
  name: string
  trackCount: number
  provider: Provider
  coverUrl: string | null
  tracks?: Track[]
}

export interface SetTrack extends Track {
  position: number
  compatibilityScore: number
  bpmAdjusted: number
  transitionType: TransitionType
}

export interface DJSet {
  id: string
  name: string
  status: SetStatus
  transitionType: TransitionType
  transitionBeats: number
  tracks: SetTrack[]
}
