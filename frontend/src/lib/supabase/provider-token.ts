import { createServerClient } from './server'

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

export async function getProviderToken(userId: string, provider: 'spotify' | 'google'): Promise<string | null> {
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
