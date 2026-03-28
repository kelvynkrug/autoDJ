import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient } from '@/lib/supabase/server'
import { BACKEND_URL } from '@/lib/constants'

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('sets')
    .select('id, name, status, transition_type, transition_beats, created_at')
    .eq('user_id', auth.auth.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  const sets = data.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    transitionType: s.transition_type,
    transitionBeats: s.transition_beats,
    createdAt: s.created_at,
  }))

  return NextResponse.json({ data: sets })
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (!body?.playlistId || !body?.name) {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'playlistId e name sao obrigatorios' } },
      { status: 400 },
    )
  }

  const {
    playlistId,
    name,
    transitionType = 'crossfade',
    transitionBeats = 16,
    autoOrder = true,
  } = body as {
    playlistId: string
    name: string
    transitionType?: string
    transitionBeats?: number
    autoOrder?: boolean
  }

  const supabase = await createServerClient()

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('user_id', auth.auth.user.id)
    .single()

  if (playlistError || !playlist) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Playlist nao encontrada' } },
      { status: 404 },
    )
  }

  const { data: djSet, error: setError } = await supabase
    .from('sets')
    .insert({
      user_id: auth.auth.user.id,
      playlist_id: playlistId,
      name,
      status: 'draft',
      transition_type: transitionType,
      transition_beats: transitionBeats,
    })
    .select()
    .single()

  if (setError) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: setError.message } },
      { status: 500 },
    )
  }

  const { data: playlistTracks } = await supabase
    .from('playlist_tracks')
    .select('track_id, position, tracks(id, status, track_analysis(bpm, camelot, energy, danceability))')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true })

  const tracks = (playlistTracks ?? [])
    .map((pt: Record<string, unknown>) => {
      const t = pt.tracks as Record<string, unknown> | null
      const analysis = t?.track_analysis as Record<string, unknown> | null
      return {
        id: t?.id as string,
        status: t?.status as string,
        bpm: analysis?.bpm as number | null,
        camelot_key: analysis?.camelot as string | null,
        energy: analysis?.energy as number | null,
        danceability: analysis?.danceability as number | null,
      }
    })

  if (!tracks || tracks.length === 0) {
    return NextResponse.json({
      data: { id: djSet.id, name, status: 'draft', trackCount: 0 },
    })
  }

  if (autoOrder) {
    try {
      const orderRes = await fetch(`${BACKEND_URL}/api/sets/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set_id: djSet.id,
          tracks: tracks.map((t) => ({
            id: t.id,
            bpm: t.bpm,
            camelot_key: t.camelot_key,
            energy: t.energy,
            danceability: t.danceability,
          })),
          transition_type: transitionType,
        }),
      })

      if (orderRes.ok) {
        const orderData = await orderRes.json()
        const setTracks = orderData.ordered_tracks.map(
          (t: { track_id: string; position: number; bpm_adjusted: number; compatibility_score: number; transition_type: string }, i: number) => ({
            set_id: djSet.id,
            track_id: t.track_id,
            position: i,
            bpm_adjusted: t.bpm_adjusted,
            compatibility_score: t.compatibility_score,
            transition_type: t.transition_type ?? transitionType,
          }),
        )

        await supabase.from('set_tracks').insert(setTracks)

        return NextResponse.json({
          data: {
            id: djSet.id,
            name,
            status: 'draft',
            trackCount: setTracks.length,
          },
        })
      }
    } catch {
      // Fallback para ordem manual se backend estiver offline
    }
  }

  const setTracks = tracks.map((t, i) => ({
    set_id: djSet.id,
    track_id: t.id,
    position: i,
    bpm_adjusted: t.bpm ?? 0,
    compatibility_score: 0,
    transition_type: transitionType,
  }))

  await supabase.from('set_tracks').insert(setTracks)

  return NextResponse.json({
    data: {
      id: djSet.id,
      name,
      status: 'draft',
      trackCount: setTracks.length,
    },
  })
}
