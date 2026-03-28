import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createServerClient } from '@/lib/supabase/server'
import { ConnectProviderButton } from './connect-provider-button'

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="group cursor-pointer">
        <p className="text-sm text-zinc-400">{label}</p>
        <p className="mt-1 text-3xl font-bold text-zinc-100">{value}</p>
      </Card>
    </Link>
  )
}

function ProviderCard({
  name,
  provider,
  connected,
  color,
}: {
  name: string
  provider: 'spotify' | 'google'
  connected: boolean
  color: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full ${color}`} />
        <span className="text-sm font-medium text-zinc-200">{name}</span>
      </div>
      {connected ? (
        <Badge variant="success">Conectado</Badge>
      ) : (
        <ConnectProviderButton provider={provider} />
      )}
    </div>
  )
}

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

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { count: playlistCount },
    { count: setCount },
    { data: recentSets },
    { data: profile },
    { count: analyzedTrackCount },
  ] = await Promise.all([
    supabase
      .from('playlists')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('sets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('sets')
      .select('*, set_tracks(id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single(),
    supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'ready'),
  ])

  const userName = profile?.display_name ?? user.user_metadata?.full_name ?? 'DJ'
  const connectedProviders: string[] = user.app_metadata?.providers ?? []
  const sets = recentSets ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          Ola, {userName}
        </h1>
        <p className="mt-1 text-zinc-400">Bem-vindo de volta ao AutoDJ</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Suas Playlists" value={playlistCount ?? 0} href="/playlists" />
        <StatCard label="Seus Sets" value={setCount ?? 0} href="/sets" />
        <Card hover={false}>
          <p className="text-sm text-zinc-400">Faixas analisadas</p>
          <p className="mt-1 text-3xl font-bold text-zinc-100">{analyzedTrackCount ?? 0}</p>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">Providers</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ProviderCard name="Spotify" provider="spotify" connected={connectedProviders.includes('spotify')} color="bg-[#1DB954]" />
          <ProviderCard name="YouTube" provider="google" connected={connectedProviders.includes('google')} color="bg-[#FF0000]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/playlists">
          <Button variant="primary" size="lg">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Importar Playlist
          </Button>
        </Link>
        <Link href="/sets">
          <Button variant="secondary" size="lg">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Criar Set
          </Button>
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">Ultimos Sets</h2>
        {sets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-12">
            <p className="text-zinc-400">Bem-vindo ao AutoDJ!</p>
            <p className="mt-1 text-sm text-zinc-600">Comece importando uma playlist.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sets.map((set) => (
              <Link key={set.id} href={`/sets/${set.id}`}>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 transition-all hover:border-zinc-700 hover:bg-zinc-900/80">
                  <div>
                    <p className="font-medium text-zinc-100">{set.name}</p>
                    <p className="text-sm text-zinc-500">
                      {set.set_tracks?.length ?? 0} faixas
                    </p>
                  </div>
                  <Badge variant={statusVariants[set.status]}>
                    {statusLabels[set.status]}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
