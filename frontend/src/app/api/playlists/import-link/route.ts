import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient } from '@/lib/supabase/server'
import { BACKEND_URL } from '@/lib/constants'
import type { Provider } from '@/lib/types'

interface ParsedLink {
  provider: Provider | 'deezer-short'
  playlistId: string
}

interface ProviderTrack {
  provider_track_id: string
  title: string
  artist: string
  album: string
  duration_ms: number
  cover_url: string | null
}

interface PlaylistData {
  name: string
  coverUrl: string | null
  tracks: ProviderTrack[]
}

function parsePlaylistUrl(url: string): ParsedLink | null {
  // Spotify: https://open.spotify.com/playlist/{id}?si=xxx
  const spotifyMatch = url.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/)
  if (spotifyMatch) return { provider: 'spotify', playlistId: spotifyMatch[1] }

  // Deezer: https://www.deezer.com/playlist/{id} ou /br/playlist/{id}
  const deezerMatch = url.match(/deezer\.com\/(?:[a-z]{2}\/)?playlist\/(\d+)/)
  if (deezerMatch) return { provider: 'deezer', playlistId: deezerMatch[1] }

  // Deezer short link: https://link.deezer.com/s/xxxxx
  if (url.includes('link.deezer.com')) return { provider: 'deezer-short', playlistId: url }

  // YouTube / YouTube Music: ?list=PLxxxxx
  const ytMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/)
  if (ytMatch) return { provider: 'google', playlistId: ytMatch[1] }

  return null
}

async function resolveDeezerShortLink(url: string): Promise<string | null> {
  const res = await fetch(url, { redirect: 'manual' })
  const location = res.headers.get('location')
  if (!location) return null
  const match = location.match(/deezer\.com\/(?:[a-z]{2}\/)?playlist\/(\d+)/)
  return match?.[1] ?? null
}

async function getSpotifyClientToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Credenciais do Spotify nao configuradas')
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

async function fetchSpotifyPlaylist(playlistId: string): Promise<PlaylistData> {
  const token = await getSpotifyClientToken()
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`Spotify API ${res.status}`)
  const playlist = await res.json()

  const itemsData = playlist.items ?? playlist.tracks
  const rawItems: Array<{ item?: Record<string, unknown>; track?: Record<string, unknown> }> =
    itemsData?.items ?? []

  // Paginacao
  let nextUrl: string | null = itemsData?.next ?? null
  while (nextUrl) {
    const pageRes = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!pageRes.ok) break
    const pageData = await pageRes.json()
    rawItems.push(...(pageData.items ?? []))
    nextUrl = pageData.next ?? null
  }

  return {
    name: playlist.name,
    coverUrl: playlist.images?.[0]?.url ?? null,
    tracks: rawItems
      .map((i) => {
        const t = (i.item ?? i.track) as Record<string, unknown> | undefined
        if (!t?.id || !t?.name) return null
        const artists = t.artists as Array<{ name: string }> | undefined
        const album = t.album as { name?: string; images?: Array<{ url: string }> } | undefined
        return {
          provider_track_id: t.id as string,
          title: t.name as string,
          artist: artists?.map((a) => a.name).join(', ') ?? 'Desconhecido',
          album: album?.name ?? '',
          duration_ms: (t.duration_ms as number) ?? 0,
          cover_url: album?.images?.[0]?.url ?? null,
        }
      })
      .filter((t): t is NonNullable<typeof t> => t !== null),
  }
}

async function fetchDeezerPlaylist(playlistId: string): Promise<PlaylistData> {
  const res = await fetch(`https://api.deezer.com/playlist/${playlistId}`)
  if (!res.ok) throw new Error(`Deezer API ${res.status}`)
  const data = await res.json()

  if (data.error) throw new Error(data.error.message ?? 'Playlist Deezer nao encontrada')

  return {
    name: data.title,
    coverUrl: data.picture_medium ?? null,
    tracks: (data.tracks?.data ?? []).map((t: Record<string, unknown>) => ({
      provider_track_id: String(t.id),
      title: t.title as string,
      artist: (t.artist as Record<string, string>)?.name ?? 'Desconhecido',
      album: (t.album as Record<string, string>)?.title ?? '',
      duration_ms: ((t.duration as number) ?? 0) * 1000,
      cover_url: (t.album as Record<string, string>)?.cover_medium ?? null,
    })),
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (!body?.url || typeof body.url !== 'string') {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'URL da playlist e obrigatoria' } },
      { status: 400 },
    )
  }

  const parsed = parsePlaylistUrl(body.url.trim())
  if (!parsed) {
    return NextResponse.json(
      { error: { code: 'INVALID_URL', message: 'Link nao reconhecido. Use links do Spotify, Deezer ou YouTube.' } },
      { status: 400 },
    )
  }

  let provider: Provider = parsed.provider === 'deezer-short' ? 'deezer' : parsed.provider
  let playlistId = parsed.playlistId

  try {
    // Resolver short link do Deezer
    if (parsed.provider === 'deezer-short') {
      const resolvedId = await resolveDeezerShortLink(parsed.playlistId)
      if (!resolvedId) {
        return NextResponse.json(
          { error: { code: 'RESOLVE_ERROR', message: 'Nao foi possivel resolver o link curto do Deezer' } },
          { status: 400 },
        )
      }
      playlistId = resolvedId
      provider = 'deezer'
    }

    let playlistData: PlaylistData

    if (provider === 'spotify') {
      playlistData = await fetchSpotifyPlaylist(playlistId)
    } else if (provider === 'deezer') {
      playlistData = await fetchDeezerPlaylist(playlistId)
    } else if (provider === 'google') {
      // YouTube sem API key: salvar playlist com 0 tracks, backend resolve depois
      playlistData = {
        name: `YouTube Playlist`,
        coverUrl: null,
        tracks: [],
      }
    } else {
      return NextResponse.json(
        { error: { code: 'UNSUPPORTED', message: 'Provider nao suportado' } },
        { status: 400 },
      )
    }

    const supabase = await createServerClient()

    // Criar playlist
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .insert({
        user_id: auth.auth.user.id,
        name: playlistData.name,
        provider,
        provider_playlist_id: playlistId,
        track_count: playlistData.tracks.length,
        cover_url: playlistData.coverUrl ?? playlistData.tracks[0]?.cover_url ?? null,
      })
      .select()
      .single()

    if (playlistError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: playlistError.message } },
        { status: 500 },
      )
    }

    // Inserir tracks se existirem
    if (playlistData.tracks.length > 0) {
      const tracksToInsert = playlistData.tracks.map((t) => ({
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
    }

    // Disparar job de download no backend
    let jobId: string | null = null
    if (playlistData.tracks.length > 0) {
      try {
        const jobRes = await fetch(`${BACKEND_URL}/api/jobs/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playlist_id: playlist.id,
            tracks: playlistData.tracks.map((t) => ({
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
    }

    return NextResponse.json({
      data: {
        playlist: { ...playlist, trackCount: playlistData.tracks.length },
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
