import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient } from '@/lib/supabase/server'
import { getProviderToken } from '@/lib/supabase/provider-token'
import { BACKEND_URL } from '@/lib/constants'
import type { Provider } from '@/lib/types'

interface SpotifyTrackItem {
  item?: {
    id: string
    name: string
    artists: { name: string }[]
    album: { name: string; images: { url: string }[] }
    duration_ms: number
  }
  track?: {
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

async function fetchDeezerTracks(playlistId: string, token: string) {
  const res = await fetch(
    `https://api.deezer.com/playlist/${playlistId}/tracks?access_token=${token}&limit=1000`,
  )
  if (!res.ok) throw new Error(`Deezer API ${res.status}`)
  const data = await res.json()
  return (data.data ?? []).map((t: Record<string, unknown>) => ({
    provider_track_id: String(t.id),
    title: t.title as string,
    artist: (t.artist as Record<string, string>)?.name ?? 'Desconhecido',
    album: (t.album as Record<string, string>)?.title ?? '',
    duration_ms: ((t.duration as number) ?? 0) * 1000,
    cover_url: (t.album as Record<string, string>)?.cover_medium ?? null,
  }))
}

async function fetchSpotifyTracks(playlistId: string, token: string) {
  // Use /playlists/{id} endpoint (works in Dev mode, unlike /playlists/{id}/tracks)
  const res: Response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Spotify API ${res.status}`)

  const playlist = await res.json()
  const itemsData = playlist.items ?? playlist.tracks
  const rawItems: SpotifyTrackItem[] = itemsData?.items ?? []

  // Handle pagination if needed
  let nextUrl: string | null = itemsData?.next ?? null
  while (nextUrl) {
    const pageRes: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!pageRes.ok) break
    const pageData = await pageRes.json()
    rawItems.push(...(pageData.items ?? []))
    nextUrl = pageData.next ?? null
  }

  return rawItems
    .map((i) => {
      const t = i.item ?? i.track
      if (!t?.id || !t?.name) return null
      return {
        provider_track_id: t.id,
        title: t.name,
        artist: t.artists?.map((a) => a.name).join(', ') ?? 'Desconhecido',
        album: t.album?.name ?? '',
        duration_ms: t.duration_ms ?? 0,
        cover_url: t.album?.images?.[0]?.url ?? null,
      }
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
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

  const providerNames: Record<string, string> = { spotify: 'Spotify', google: 'YouTube', deezer: 'Deezer' }
  const providerName = providerNames[provider] ?? provider
  const providerToken = await getProviderToken(auth.auth.user.id, provider)
  if (!providerToken) {
    return NextResponse.json(
      { error: { code: 'NO_PROVIDER_TOKEN', message: `Token do ${providerName} expirado. Reconecte sua conta.` } },
      { status: 401 },
    )
  }

  try {
    const trackFetchers: Record<Provider, (id: string, token: string) => ReturnType<typeof fetchSpotifyTracks>> = {
      spotify: fetchSpotifyTracks,
      google: fetchYouTubeTracks,
      deezer: fetchDeezerTracks,
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

    // Insert tracks
    const tracksToInsert = providerTracks.map((t) => ({
      user_id: auth.auth.user.id,
      title: t.title,
      artist: t.artist,
      album: t.album || null,
      duration_ms: t.duration_ms,
      cover_url: t.cover_url,
      spotify_id: provider === 'spotify' ? t.provider_track_id : null,
      youtube_id: provider === 'google' ? t.provider_track_id : null,
      deezer_id: provider === 'deezer' ? t.provider_track_id : null,
      status: 'pending' as const,
    }))

    const { data: insertedTracks, error: tracksError } = await supabase
      .from('tracks')
      .insert(tracksToInsert)
      .select('id')

    if (tracksError || !insertedTracks) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: tracksError?.message ?? 'Erro ao inserir tracks' } },
        { status: 500 },
      )
    }

    // Insert playlist_tracks (junction)
    const playlistTracks = insertedTracks.map((t: { id: string }, index: number) => ({
      playlist_id: playlist.id,
      track_id: t.id,
      position: index,
    }))

    const { error: junctionError } = await supabase
      .from('playlist_tracks')
      .insert(playlistTracks)

    if (junctionError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: junctionError.message } },
        { status: 500 },
      )
    }

    try {
      const downloadTracks = insertedTracks.map((t: { id: string }, i: number) => ({
        track_id: t.id,
        query: `${providerTracks[i].artist} - ${providerTracks[i].title}`,
        youtube_id: provider === 'google' ? providerTracks[i].provider_track_id : null,
        artist: providerTracks[i].artist,
        title: providerTracks[i].title,
      }))

      await fetch(`${BACKEND_URL}/api/v1/download/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: downloadTracks }),
      })
    } catch {
      // Backend offline nao deve bloquear a importacao
    }

    return NextResponse.json({
      data: {
        playlist: { ...playlist, trackCount: providerTracks.length },
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
