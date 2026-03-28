import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient } from '@/lib/supabase/server'
import type { Provider } from '@/lib/types'

interface SpotifyPlaylist {
  id: string
  name: string
  images: { url: string }[]
  tracks: { total: number }
}

interface YouTubePlaylist {
  id: string
  snippet: { title: string; thumbnails: { default: { url: string } } }
  contentDetails: { itemCount: number }
}

async function refreshSpotifyToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? '641dd6eeedd3443e86ac198de2eadf28',
      client_secret: process.env.SPOTIFY_CLIENT_SECRET ?? '91756e9a108d4617ad9d5309729892ad',
    }),
  })

  if (!res.ok) return null
  return res.json()
}

async function getProviderToken(userId: string, provider: 'spotify' | 'google'): Promise<string | null> {
  const supabase = await createServerClient()

  const { data: conn } = await supabase
    .from('provider_connections')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (!conn) return null

  const isExpired = conn.token_expires_at && new Date(conn.token_expires_at) < new Date()

  if (!isExpired) return conn.access_token

  if (provider === 'spotify' && conn.refresh_token) {
    const refreshed = await refreshSpotifyToken(conn.refresh_token)
    if (refreshed) {
      await supabase
        .from('provider_connections')
        .update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq('user_id', userId)
        .eq('provider', provider)

      return refreshed.access_token
    }
  }

  return null
}

async function fetchSpotifyPlaylists(token: string) {
  const items: SpotifyPlaylist[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50'

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Spotify API ${res.status}: ${body}`)
    }

    const data: { items: SpotifyPlaylist[]; next: string | null } = await res.json()
    items.push(...(data.items ?? []))
    url = data.next
  }

  return items
    .filter((p) => p && p.id && p.name)
    .map((p) => ({
      id: p.id,
      name: p.name,
      trackCount: p.tracks?.total ?? 0,
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

  const providerToken = await getProviderToken(auth.auth.user.id, provider)
  if (!providerToken) {
    return NextResponse.json(
      { error: { code: 'NO_PROVIDER_TOKEN', message: 'Token do provider expirado. Reconecte sua conta no Dashboard.' } },
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
