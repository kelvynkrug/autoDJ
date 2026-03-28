import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('playlists')
    .select('id, name, provider, track_count, cover_url, created_at')
    .eq('user_id', auth.auth.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  const playlists = data.map((p) => ({
    id: p.id,
    name: p.name,
    provider: p.provider,
    trackCount: p.track_count,
    coverUrl: p.cover_url,
    createdAt: p.created_at,
  }))

  return NextResponse.json({ data: playlists })
}
