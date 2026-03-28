import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { getProviderToken } from '@/lib/supabase/provider-token'
import type { Provider } from '@/lib/types'

interface SpotifyPlaylist {
  id: string
  name: string
  images: { url: string }[]
  tracks?: { href: string; total: number }
  items?: { href: string; total: number }
}

interface YouTubePlaylist {
  id: string
  snippet: { title: string; thumbnails: { default: { url: string } } }
  contentDetails: { itemCount: number }
}

async function fetchSpotifyPlaylists(token: string) {
  const items: SpotifyPlaylist[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50'

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Spotify API ${res.status}: ${body}`)
    }

    const data: { items?: SpotifyPlaylist[]; next?: string | null } = await res.json()
    if (data.items) {
      items.push(...data.items)
    }
    url = data.next ?? null
  }

  return items
    .filter((p: SpotifyPlaylist) => p && p.id && p.name)
    .map((p: SpotifyPlaylist) => ({
      id: p.id,
      name: p.name,
      trackCount: p.tracks?.total ?? p.items?.total ?? 0,
      provider: 'spotify' as const,
      coverUrl: p.images?.[0]?.url ?? null,
    }))
}

interface DeezerPlaylist {
  id: number
  title: string
  nb_tracks: number
  picture_medium: string | null
}

async function fetchDeezerPlaylists(token: string) {
  const res = await fetch(`https://api.deezer.com/user/me/playlists?access_token=${token}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Deezer API ${res.status}: ${body}`)
  }
  const data: { data?: DeezerPlaylist[] } = await res.json()
  return (data.data ?? []).map((p) => ({
    id: String(p.id),
    name: p.title,
    trackCount: p.nb_tracks,
    provider: 'deezer' as const,
    coverUrl: p.picture_medium ?? null,
  }))
}

async function fetchYouTubePlaylists(token: string) {
  const items: YouTubePlaylist[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      mine: 'true',
      part: 'snippet,contentDetails',
      maxResults: '50',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`YouTube API ${res.status}: ${body}`)
    }

    const data = await res.json()
    items.push(...(data.items ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return items.map((p) => ({
    id: p.id,
    name: p.snippet.title,
    trackCount: p.contentDetails.itemCount,
    provider: 'google' as const,
    coverUrl: p.snippet.thumbnails?.default?.url ?? null,
  }))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { provider } = await params
  if (provider !== 'spotify' && provider !== 'google' && provider !== 'deezer') {
    return NextResponse.json(
      { error: { code: 'INVALID_PROVIDER', message: `Provider "${provider}" nao suportado` } },
      { status: 400 },
    )
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
    const fetchers: Record<Provider, (token: string) => Promise<unknown>> = {
      spotify: fetchSpotifyPlaylists,
      google: fetchYouTubePlaylists,
      deezer: fetchDeezerPlaylists,
    }

    const playlists = await fetchers[provider](providerToken)
    return NextResponse.json({ data: playlists })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar playlists'
    return NextResponse.json(
      { error: { code: 'PROVIDER_ERROR', message } },
      { status: 502 },
    )
  }
}
