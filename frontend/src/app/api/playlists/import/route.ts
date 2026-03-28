import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient } from '@/lib/supabase/server'
import { BACKEND_URL } from '@/lib/constants'
import type { Provider } from '@/lib/types'

interface SpotifyTrackItem {
  track: {
    id: string
    name: string
    artists: { name: string }[]
    album: { name: string; images: { url: string }[] }
    duration_ms: number
  }
}

interface YouTubePlaylistItem {
  snippet: {
    title: string
    videoOwnerChannelTitle: string
    thumbnails: { default: { url: string } }
    resourceId: { videoId: string }
  }
}

async function fetchSpotifyTracks(playlistId: string, token: string) {
  const items: SpotifyTrackItem[] = []
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,artists,album,duration_ms)),next`

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Spotify API ${res.status}`)

    const data: { items: SpotifyTrackItem[]; next: string | null } = await res.json()
    items.push(...data.items.filter((i: SpotifyTrackItem) => i.track))
    url = data.next
  }

  return items.map((i) => ({
    provider_track_id: i.track.id,
    title: i.track.name,
    artist: i.track.artists.map((a) => a.name).join(', '),
    album: i.track.album.name,
    duration_ms: i.track.duration_ms,
    cover_url: i.track.album.images?.[0]?.url ?? null,
  }))
}

async function fetchYouTubeTracks(playlistId: string, token: string) {
  const items: YouTubePlaylistItem[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      playlistId,
      part: 'snippet',
      maxResults: '50',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) throw new Error(`YouTube API ${res.status}`)

    const data = await res.json()
    items.push(...data.items)
    pageToken = data.nextPageToken
  } while (pageToken)

  return items.map((i) => ({
    provider_track_id: i.snippet.resourceId.videoId,
    title: i.snippet.title,
    artist: i.snippet.videoOwnerChannelTitle?.replace(/ - Topic$/, '') ?? 'Desconhecido',
    album: '',
    duration_ms: 0,
    cover_url: i.snippet.thumbnails?.default?.url ?? null,
  }))
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (!body?.provider || !body?.providerPlaylistId) {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'provider e providerPlaylistId sao obrigatorios' } },
      { status: 400 },
    )
  }

  const { provider, providerPlaylistId, name } = body as {
    provider: Provider
    providerPlaylistId: string
    name?: string
  }

  const providerToken = auth.auth.session.provider_token
  if (!providerToken) {
    return NextResponse.json(
      { error: { code: 'NO_PROVIDER_TOKEN', message: 'Token do provider nao disponivel' } },
      { status: 401 },
    )
  }

  try {
    const trackFetchers: Record<Provider, (id: string, token: string) => ReturnType<typeof fetchSpotifyTracks>> = {
      spotify: fetchSpotifyTracks,
      google: fetchYouTubeTracks,
    }

    const providerTracks = await trackFetchers[provider](providerPlaylistId, providerToken)

    const supabase = await createServerClient()

    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .insert({
        user_id: auth.auth.user.id,
        name: name ?? `Playlist ${provider}`,
        provider,
        provider_playlist_id: providerPlaylistId,
        track_count: providerTracks.length,
        cover_url: providerTracks[0]?.cover_url ?? null,
      })
      .select()
      .single()

    if (playlistError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: playlistError.message } },
        { status: 500 },
      )
    }

    const tracksToInsert = providerTracks.map((t, index) => ({
      playlist_id: playlist.id,
      provider_track_id: t.provider_track_id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration_ms: t.duration_ms,
      cover_url: t.cover_url,
      position: index,
      status: 'pending' as const,
    }))

    const { error: tracksError } = await supabase
      .from('tracks')
      .insert(tracksToInsert)

    if (tracksError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: tracksError.message } },
        { status: 500 },
      )
    }

    let jobId: string | null = null
    try {
      const jobRes = await fetch(`${BACKEND_URL}/api/jobs/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlist_id: playlist.id,
          tracks: providerTracks.map((t) => ({
            provider_track_id: t.provider_track_id,
            title: t.title,
            artist: t.artist,
            provider,
          })),
        }),
      })

      if (jobRes.ok) {
        const jobData = await jobRes.json()
        jobId = jobData.job_id ?? null
      }
    } catch {
      // Backend offline nao deve bloquear a importacao
    }

    return NextResponse.json({
      data: {
        playlist: { ...playlist, trackCount: providerTracks.length },
        jobId,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao importar playlist'
    return NextResponse.json(
      { error: { code: 'IMPORT_ERROR', message } },
      { status: 500 },
    )
  }
}
