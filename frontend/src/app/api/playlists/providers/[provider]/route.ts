import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { getProviderToken } from '@/lib/supabase/provider-token'
import type { Provider } from '@/lib/types'

interface SpotifyPlaylist {
  id: string
  name: string
  images: { url: string }[]
  tracks: { href: string; total: number } | null
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
      trackCount: typeof p.tracks === 'object' && p.tracks !== null ? p.tracks.total : 0,
      provider: 'spotify' as const,
      coverUrl: p.images?.[0]?.url ?? null,
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
  if (provider !== 'spotify' && provider !== 'google') {
    return NextResponse.json(
      { error: { code: 'INVALID_PROVIDER', message: `Provider "${provider}" nao suportado` } },
      { status: 400 },
    )
  }

  const providerName = provider === 'spotify' ? 'Spotify' : 'YouTube'
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
