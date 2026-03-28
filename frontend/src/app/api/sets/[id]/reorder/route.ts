import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient } from '@/lib/supabase/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (!body?.trackIds || !Array.isArray(body.trackIds)) {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'trackIds (array) e obrigatorio' } },
      { status: 400 },
    )
  }

  const { id } = await params
  const trackIds: string[] = body.trackIds
  const supabase = await createServerClient()

  const { data: djSet, error: setError } = await supabase
    .from('sets')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.auth.user.id)
    .single()

  if (setError || !djSet) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Set nao encontrado' } },
      { status: 404 },
    )
  }

  const updates = trackIds.map((trackId, index) =>
    supabase
      .from('set_tracks')
      .update({ position: index })
      .eq('set_id', id)
      .eq('track_id', trackId),
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)

  if (failed?.error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: failed.error.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: { success: true, order: trackIds } })
}
