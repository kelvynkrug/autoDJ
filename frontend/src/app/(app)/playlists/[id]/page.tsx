import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { TrackRow } from '@/components/playlist/track-row'
import { ProcessingPoller } from '@/components/playlist/processing-poller'
import { createServerClient } from '@/lib/supabase/server'
import type { Track, TrackAnalysis, CamelotKey, TrackStatus } from '@/lib/types'

interface PlaylistTrackRow {
  position: number
  tracks: {
    id: string
    title: string
    artist: string
    album: string | null
    duration_ms: number | null
    cover_url: string | null
    status: TrackStatus
    track_analysis: {
      bpm: number
      camelot: CamelotKey
      energy: number
      danceability: number
    }[] | null
  }
}

function mapTrack(row: PlaylistTrackRow): Track {
  const t = row.tracks
  const analysis = t.track_analysis?.[0]
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album ?? '',
    durationMs: t.duration_ms ?? 0,
    coverUrl: t.cover_url,
    status: t.status,
    analysis: analysis ? {
      bpm: analysis.bpm,
      camelot: analysis.camelot,
      energy: analysis.energy,
      danceability: analysis.danceability,
    } : undefined,
  }
}

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id, name, track_count, provider, cover_url, playlist_tracks(position, tracks(id, title, artist, album, duration_ms, cover_url, status, track_analysis(bpm, camelot, energy, danceability)))')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!playlist) notFound()

  const tracks = ((playlist.playlist_tracks ?? []) as unknown as PlaylistTrackRow[])
    .sort((a, b) => a.position - b.position)
    .map(mapTrack)

  const readyCount = tracks.filter((t) => t.status === 'ready').length
  const allReady = tracks.length > 0 && readyCount === tracks.length
  const isProcessing = tracks.some((t) =>
    ['searching', 'downloading', 'analyzing'].includes(t.status),
  )
  const providerBadge = playlist.provider === 'spotify'
    ? 'spotify'
    : playlist.provider === 'google'
      ? 'youtube'
      : 'default'
  const providerLabel = playlist.provider === 'spotify'
    ? 'Spotify'
    : playlist.provider === 'google'
      ? 'YouTube'
      : 'Criada'

  const hasPendingTracks = tracks.some((t) =>
    ['pending', 'searching', 'downloading', 'analyzing'].includes(t.status),
  )

  return (
    <div className="space-y-6">
      <ProcessingPoller hasPendingTracks={hasPendingTracks} />
      <Link
        href="/playlists"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Voltar para Playlists
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="h-40 w-40 shrink-0 overflow-hidden rounded-xl bg-zinc-800 shadow-2xl">
          {playlist.cover_url ? (
            <img
              src={playlist.cover_url}
              alt={playlist.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-600">
              <svg className="h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <Badge variant={providerBadge as 'spotify' | 'youtube' | 'default'}>{providerLabel}</Badge>
            <h1 className="mt-2 text-3xl font-bold text-zinc-100">{playlist.name}</h1>
            <p className="mt-1 text-zinc-400">{tracks.length} faixas</p>
          </div>

          {isProcessing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Processando faixas...</span>
                <span className="tabular-nums text-zinc-300">
                  {readyCount}/{tracks.length}
                </span>
              </div>
              <ProgressBar
                value={readyCount}
                max={tracks.length}
                color="violet"
                animated
              />
            </div>
          )}

          <Link href={`/sets/new?playlist=${playlist.id}`}>
            <Button
              variant="primary"
              size="lg"
              className="mt-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Criar Set
            </Button>
          </Link>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-12">
          <p className="text-zinc-400">Nenhuma faixa nesta playlist</p>
          <p className="mt-1 text-sm text-zinc-600">As faixas aparecerão aqui após a importação.</p>
        </div>
      ) : (
        <div>
          <div className="hidden sm:grid grid-cols-[2rem_2.5rem_1fr_5rem_4rem_4rem_6rem_5rem] gap-3 px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
            <span className="text-right">#</span>
            <span />
            <span>Titulo</span>
            <span className="text-right">Duracao</span>
            <span className="text-center">BPM</span>
            <span className="text-center">Key</span>
            <span>Energy</span>
            <span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
