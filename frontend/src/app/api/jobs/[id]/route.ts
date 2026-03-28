import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { BACKEND_URL } from '@/lib/constants'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const res = await fetch(`${BACKEND_URL}/api/jobs/${id}`, {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Job nao encontrado' } },
          { status: 404 },
        )
      }
      throw new Error(`Backend ${res.status}`)
    }

    const jobData = await res.json()

    return NextResponse.json({
      data: {
        id: jobData.id,
        status: jobData.status,
        progress: jobData.progress ?? 0,
        totalTracks: jobData.total_tracks ?? 0,
        completedTracks: jobData.completed_tracks ?? 0,
        errors: jobData.errors ?? [],
        createdAt: jobData.created_at,
        updatedAt: jobData.updated_at,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao consultar status do job'
    return NextResponse.json(
      { error: { code: 'BACKEND_ERROR', message } },
      { status: 502 },
    )
  }
}
