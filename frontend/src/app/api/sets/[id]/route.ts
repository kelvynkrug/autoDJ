import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = await createServerClient()

  const { data: djSet, error: setError } = await supabase
    .from('sets')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.auth.user.id)
    .single()

  if (setError || !djSet) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Set nao encontrado' } },
      { status: 404 },
    )
  }

  const { data: setTracks, error: tracksError } = await supabase
    .from('set_tracks')
    .select(`
      position,
      bpm_adjusted,
      compatibility_score,
      transition_type,
      tracks (
        id,
        title,
        artist,
        album,
        duration_ms,
        cover_url,
        status,
        bpm,
        camelot_key,
        energy,
        danceability
      )
    `)
    .eq('set_id', id)
    .order('position', { ascending: true })

  if (tracksError) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: tracksError.message } },
      { status: 500 },
    )
  }

  interface SetTrackRow {
    position: number
    bpm_adjusted: number
    compatibility_score: number
    transition_type: string
    tracks: {
      id: string
      title: string
      artist: string
      album: string
      duration_ms: number
      cover_url: string | null
      status: string
      bpm: number | null
      camelot_key: string | null
      energy: number | null
      danceability: number | null
    }
  }

  return NextResponse.json({
    data: {
      id: djSet.id,
      name: djSet.name,
      status: djSet.status,
      transitionType: djSet.transition_type,
      transitionBeats: djSet.transition_beats,
      createdAt: djSet.created_at,
      tracks: (setTracks as unknown as SetTrackRow[]).map((st) => ({
        id: st.tracks.id,
        title: st.tracks.title,
        artist: st.tracks.artist,
        album: st.tracks.album,
        durationMs: st.tracks.duration_ms,
        coverUrl: st.tracks.cover_url,
        status: st.tracks.status,
        position: st.position,
        bpmAdjusted: st.bpm_adjusted,
        compatibilityScore: st.compatibility_score,
        transitionType: st.transition_type,
        analysis: st.tracks.bpm
          ? {
              bpm: st.tracks.bpm,
              camelot: st.tracks.camelot_key,
              energy: st.tracks.energy,
              danceability: st.tracks.danceability,
            }
          : undefined,
      })),
    },
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('sets')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.auth.user.id)

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: { success: true } })
}
