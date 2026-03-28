import type { SetTrack } from '@/lib/types'

/**
 * Extensão do SetTrack com campos de runtime necessários para o audio engine.
 * `audioUrl` vem da pre-signed URL gerada pelo backend (GET /api/tracks/:id/audio-url).
 * `outroStartS` vem da análise do Essentia (track_analysis.outro_start_s).
 */
export interface PlayableTrack extends SetTrack {
  audioUrl: string
  outroStartS?: number | null
}
