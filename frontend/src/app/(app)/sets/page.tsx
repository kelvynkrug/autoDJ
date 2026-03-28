import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createServerClient } from '@/lib/supabase/server'

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  ready: 'Pronto',
  playing: 'Tocando',
  paused: 'Pausado',
  finished: 'Finalizado',
}

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'processing'> = {
  draft: 'default',
  ready: 'success',
  playing: 'processing',
  paused: 'warning',
  finished: 'default',
}

interface SetRow {
  id: string
  name: string
  status: string
  transition_type: string
  transition_beats: number
  total_duration_ms: number | null
  set_tracks: { id: string; tracks: { duration_ms: number | null } }[]
}

function formatDuration(tracks: { tracks: { duration_ms: number | null } }[]): string {
  const totalMs = tracks.reduce((sum, t) => sum + (t.tracks?.duration_ms ?? 0), 0)
  const minutes = Math.floor(totalMs / 60000)
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}min`
  }
  return `${minutes}min`
}

export default async function SetsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: setsData } = await supabase
    .from('sets')
    .select('id, name, status, transition_type, transition_beats, total_duration_ms, set_tracks(id, tracks(duration_ms))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const sets = (setsData ?? []) as unknown as SetRow[]

  if (sets.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Sets</h1>
          <p className="mt-1 text-zinc-400">Crie e gerencie seus sets de DJ</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
          <svg className="h-12 w-12 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          <p className="mt-4 text-zinc-400">Nenhum set criado</p>
          <p className="mt-1 text-sm text-zinc-600">Importe uma playlist e crie seu primeiro set.</p>
          <Link href="/playlists" className="mt-4">
            <Button variant="primary">Importar Playlist</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Sets</h1>
          <p className="mt-1 text-zinc-400">Crie e gerencie seus sets de DJ</p>
        </div>
        <Button variant="primary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Set
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sets.map((set) => (
          <Link key={set.id} href={`/sets/${set.id}`}>
            <Card className="h-full">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-zinc-100">{set.name}</h3>
                <Badge variant={statusVariants[set.status]}>
                  {statusLabels[set.status]}
                </Badge>
              </div>
              <div className="mt-4 space-y-1 text-sm text-zinc-400">
                <p>{set.set_tracks?.length ?? 0} faixas</p>
                <p>{formatDuration(set.set_tracks ?? [])}</p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="default">{set.transition_type.replace('_', ' ')}</Badge>
                <Badge variant="default">{set.transition_beats} beats</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
