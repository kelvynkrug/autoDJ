import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createServerClient } from '@/lib/supabase/server'

interface GenerateBody {
  genres: string[]
  mood: string
  decades: string[]
  count: number
}

interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: { name: string; images: { url: string }[] }
  duration_ms: number
  external_urls: { spotify: string }
}

interface SpotifyRecommendation {
  tracks: SpotifyTrack[]
}

interface YouTubeSearchItem {
  id: { videoId: string }
  snippet: {
    title: string
    channelTitle: string
    thumbnails: { default: { url: string } }
  }
}

const GENRE_MAP: Record<string, string> = {
  'pop': 'pop',
  'rock': 'rock',
  'eletronica': 'electronic',
  'hip-hop': 'hip-hop',
  'rnb': 'r-n-b',
  'funk': 'funk',
  'sertanejo': 'sertanejo',
  'reggaeton': 'reggaeton',
  'jazz': 'jazz',
  'lofi': 'chill',
  'indie': 'indie',
  'metal': 'metal',
  'mpb': 'mpb',
  'pagode': 'pagode',
  'forro': 'forro',
  'kpop': 'k-pop',
}

const MOOD_ENERGY: Record<string, { energy: number; danceability: number }> = {
  'animada': { energy: 0.8, danceability: 0.7 },
  'chill': { energy: 0.3, danceability: 0.4 },
  'romantica': { energy: 0.4, danceability: 0.5 },
  'workout': { energy: 0.9, danceability: 0.7 },
  'nostalgica': { energy: 0.5, danceability: 0.5 },
}

interface TrackSuggestion {
  title: string
  artist: string
  spotifyId?: string
  youtubeId?: string
  thumbnailUrl: string | null
  durationMs: number
  album: string
}

async function generateViaSpotify(
  body: GenerateBody,
  spotifyToken: string,
): Promise<TrackSuggestion[]> {
  const seedGenres = body.genres
    .map((g) => GENRE_MAP[g])
    .filter(Boolean)
    .slice(0, 5)

  const moodParams = MOOD_ENERGY[body.mood] ?? { energy: 0.5, danceability: 0.5 }

  const params = new URLSearchParams({
    seed_genres: seedGenres.join(','),
    target_energy: String(moodParams.energy),
    target_danceability: String(moodParams.danceability),
    limit: String(Math.min(body.count, 100)),
  })

  const res = await fetch(
    `https://api.spotify.com/v1/recommendations?${params}`,
    { headers: { Authorization: `Bearer ${spotifyToken}` } },
  )

  if (!res.ok) {
    throw new Error(`Spotify API ${res.status}`)
  }

  const data: SpotifyRecommendation = await res.json()

  return data.tracks.map((t) => ({
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    spotifyId: t.id,
    thumbnailUrl: t.album.images?.[0]?.url ?? null,
    durationMs: t.duration_ms,
    album: t.album.name,
  }))
}

function buildYouTubeQueries(body: GenerateBody): string[] {
  const moodTerms: Record<string, string> = {
    'animada': 'party hits upbeat',
    'chill': 'chill relaxing ambient',
    'romantica': 'love songs romantic',
    'workout': 'workout motivation energy',
    'nostalgica': 'classic throwback hits',
  }

  const moodTerm = moodTerms[body.mood] ?? ''
  const queries: string[] = []

  for (const genre of body.genres) {
    for (const decade of body.decades) {
      const decadeTerm = decade === 'qualquer' ? '' : decade
      queries.push(`${genre} ${moodTerm} ${decadeTerm} music`.trim())
    }
  }

  return queries
}

async function generateViaYouTube(
  body: GenerateBody,
  googleToken: string,
): Promise<TrackSuggestion[]> {
  const queries = buildYouTubeQueries(body)
  const perQuery = Math.ceil(body.count / queries.length)
  const tracks: TrackSuggestion[] = []
  const seenIds = new Set<string>()

  for (const query of queries) {
    if (tracks.length >= body.count) break

    const params = new URLSearchParams({
      q: query,
      type: 'video',
      videoCategoryId: '10',
      part: 'snippet',
      maxResults: String(Math.min(perQuery, 25)),
    })

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      { headers: { Authorization: `Bearer ${googleToken}` } },
    )

    if (!res.ok) continue

    const data: { items: YouTubeSearchItem[] } = await res.json()

    for (const item of data.items) {
      if (seenIds.has(item.id.videoId)) continue
      seenIds.add(item.id.videoId)

      const titleParts = item.snippet.title.split(' - ')
      const artist = titleParts.length > 1
        ? titleParts[0].trim()
        : item.snippet.channelTitle.replace(/ - Topic$/, '')
      const title = titleParts.length > 1
        ? titleParts.slice(1).join(' - ').trim()
        : item.snippet.title

      tracks.push({
        title,
        artist,
        youtubeId: item.id.videoId,
        thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null,
        durationMs: 0,
        album: '',
      })
    }
  }

  return tracks.slice(0, body.count)
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null) as GenerateBody | null

  if (
    !body?.genres?.length ||
    !body.mood ||
    !body.decades?.length ||
    !body.count
  ) {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'genres, mood, decades e count sao obrigatorios' } },
      { status: 400 },
    )
  }

  if (body.genres.length > 5) {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Maximo de 5 generos' } },
      { status: 400 },
    )
  }

  if (body.count < 10 || body.count > 50) {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'count deve ser entre 10 e 50' } },
      { status: 400 },
    )
  }

  try {
    const supabase = await createServerClient()

    const { data: spotifyConn } = await supabase
      .from('provider_connections')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', auth.auth.user.id)
      .eq('provider', 'spotify')
      .single()

    let tracks: TrackSuggestion[]
    let source: 'spotify' | 'youtube'

    if (spotifyConn?.access_token) {
      try {
        tracks = await generateViaSpotify(body, spotifyConn.access_token)
        source = 'spotify'
      } catch {
        tracks = await generateViaYouTube(body, auth.auth.session.provider_token ?? '')
        source = 'youtube'
      }
    } else if (auth.auth.session.provider_token) {
      tracks = await generateViaYouTube(body, auth.auth.session.provider_token)
      source = 'youtube'
    } else {
      return NextResponse.json(
        { error: { code: 'NO_PROVIDER', message: 'Nenhum provider conectado para buscar musicas' } },
        { status: 400 },
      )
    }

    return NextResponse.json({ data: { tracks, source } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar sugestoes'
    return NextResponse.json(
      { error: { code: 'GENERATE_ERROR', message } },
      { status: 500 },
    )
  }
}
