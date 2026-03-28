import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient } from '@/lib/supabase/server'
import { BACKEND_URL } from '@/lib/constants'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = await createServerClient()

  const { data: djSet, error: setError } = await supabase
    .from('sets')
    .select('id, transition_type')
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
    .select('track_id, position, tracks(id, title, track_analysis(bpm, camelot, energy, danceability))')
    .eq('set_id', id)
    .order('position')

  if (tracksError || !setTracks || setTracks.length === 0) {
    return NextResponse.json(
      { error: { code: 'NO_TRACKS', message: 'Set sem faixas' } },
      { status: 400 },
    )
  }

  type TrackRow = {
    track_id: string
    position: number
    tracks: {
      id: string
      title: string
      track_analysis: { bpm: number; camelot: string; energy: number; danceability: number }[] | null
    }
  }

  const rows = setTracks as unknown as TrackRow[]

  const tracksForBackend = rows
    .filter((r) => r.tracks.track_analysis && r.tracks.track_analysis.length > 0)
    .map((r) => {
      const analysis = r.tracks.track_analysis![0]
      return {
        track_id: r.track_id,
        bpm: analysis.bpm,
        camelot: analysis.camelot,
        energy: analysis.energy,
        danceability: analysis.danceability,
        title: r.tracks.title ?? '',
      }
    })

  if (tracksForBackend.length < 2) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_DATA', message: 'Menos de 2 faixas com analise disponivel' } },
      { status: 400 },
    )
  }

  try {
    const orderRes = await fetch(`${BACKEND_URL}/api/v1/ordering/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks: tracksForBackend }),
    })

    if (!orderRes.ok) {
      return NextResponse.json(
        { error: { code: 'BACKEND_ERROR', message: 'Falha ao otimizar ordem' } },
        { status: 502 },
      )
    }

    const orderData = await orderRes.json()
    const orderedTracks: { track_id: string; position: number; transition_score: number }[] =
      orderData.ordered_tracks

    const updates = orderedTracks.map((t, i) =>
      supabase
        .from('set_tracks')
        .update({
          position: i,
          compatibility_score: t.transition_score,
        })
        .eq('set_id', id)
        .eq('track_id', t.track_id),
    )

    const results = await Promise.all(updates)
    const failed = results.find((r) => r.error)

    if (failed?.error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: failed.error.message } },
        { status: 500 },
      )
    }

    return NextResponse.json({
      data: { success: true, order: orderedTracks.map((t) => t.track_id) },
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'BACKEND_UNREACHABLE', message: 'Backend indisponivel' } },
      { status: 502 },
    )
  }
}
