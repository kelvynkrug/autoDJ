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

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.auth.user.id)
    .single()

  if (playlistError || !playlist) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Playlist nao encontrada' } },
      { status: 404 },
    )
  }

  const { data: tracks, error: tracksError } = await supabase
    .from('tracks')
    .select('*')
    .eq('playlist_id', id)
    .order('position', { ascending: true })

  if (tracksError) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: tracksError.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: {
      id: playlist.id,
      name: playlist.name,
      provider: playlist.provider,
      trackCount: playlist.track_count,
      coverUrl: playlist.cover_url,
      createdAt: playlist.created_at,
      tracks: tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        durationMs: t.duration_ms,
        coverUrl: t.cover_url,
        status: t.status,
        analysis: t.bpm
          ? {
              bpm: t.bpm,
              camelot: t.camelot_key,
              energy: t.energy,
              danceability: t.danceability,
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
    .from('playlists')
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
