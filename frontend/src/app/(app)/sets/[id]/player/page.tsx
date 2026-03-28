import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import type { SetTrack, TransitionType, CamelotKey, TrackStatus } from '@/lib/types'
import { PlayerClient } from './player-client'

interface SetTrackRow {
  position: number
  bpm_adjusted: number | null
  compatibility_score: number | null
  transition_type: TransitionType | null
  tracks: {
    id: string
    title: string
    artist: string
    album: string | null
    duration_ms: number | null
    cover_url: string | null
    status: TrackStatus
    track_analysis: {
      bpm: number
      camelot: CamelotKey
      energy: number
      danceability: number
    }[] | null
  }
}

function mapSetTrack(row: SetTrackRow): SetTrack {
  const t = row.tracks
  const analysis = t.track_analysis?.[0]
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album ?? '',
    durationMs: t.duration_ms ?? 0,
    coverUrl: t.cover_url,
    status: t.status,
    position: row.position,
    bpmAdjusted: row.bpm_adjusted ?? analysis?.bpm ?? 0,
    compatibilityScore: row.compatibility_score ?? 0,
    transitionType: row.transition_type ?? 'crossfade',
    analysis: analysis ? {
      bpm: analysis.bpm,
      camelot: analysis.camelot,
      energy: analysis.energy,
      danceability: analysis.danceability,
    } : undefined,
  }
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: set } = await supabase
    .from('sets')
    .select('id, name, status, transition_type, transition_beats, set_tracks(position, bpm_adjusted, compatibility_score, transition_type, tracks(id, title, artist, album, duration_ms, cover_url, status, track_analysis(bpm, camelot, energy, danceability)))')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!set) notFound()

  const tracks = ((set.set_tracks ?? []) as unknown as SetTrackRow[])
    .sort((a, b) => a.position - b.position)
    .map(mapSetTrack)

  return (
    <PlayerClient
      set={{
        id: set.id,
        name: set.name,
        status: set.status,
        transitionType: set.transition_type as TransitionType,
        transitionBeats: set.transition_beats,
        tracks,
      }}
    />
  )
}
