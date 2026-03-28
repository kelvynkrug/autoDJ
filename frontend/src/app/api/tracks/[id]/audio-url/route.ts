import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

const SIGNED_URL_EXPIRY = 3600 // 1 hora

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = await createServerClient()

  const { data: track, error: trackError } = await supabase
    .from('tracks')
    .select('id, duration_ms, status, storage_path, playlists!inner(user_id)')
    .eq('id', id)
    .single()

  if (trackError || !track) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Track nao encontrada' } },
      { status: 404 },
    )
  }

  const playlist = track.playlists as unknown as { user_id: string }
  if (playlist.user_id !== auth.auth.user.id) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Sem permissao para acessar esta track' } },
      { status: 403 },
    )
  }

  if (track.status !== 'ready' || !track.storage_path) {
    return NextResponse.json(
      { error: { code: 'NOT_READY', message: 'Audio ainda nao esta disponivel' } },
      { status: 409 },
    )
  }

  const serviceClient = await createServiceClient()

  const { data: signedUrlData, error: signedUrlError } = await serviceClient
    .storage
    .from('audio')
    .createSignedUrl(track.storage_path, SIGNED_URL_EXPIRY)

  if (signedUrlError || !signedUrlData) {
    return NextResponse.json(
      { error: { code: 'STORAGE_ERROR', message: 'Erro ao gerar URL do audio' } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: {
      url: signedUrlData.signedUrl,
      expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY * 1000).toISOString(),
      format: 'mp3',
      durationMs: track.duration_ms,
    },
  })
}
