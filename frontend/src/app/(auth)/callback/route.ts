import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      const { session } = data
      const providerToken = session.provider_token
      const providerRefreshToken = session.provider_refresh_token

      if (providerToken) {
        const provider = session.user.app_metadata?.provider as string
        const providerType = provider === 'google' ? 'google' : 'spotify'

        await supabase.from('provider_connections').upsert(
          {
            user_id: session.user.id,
            provider: providerType,
            provider_user_id: session.user.user_metadata?.provider_id ?? session.user.id,
            display_name: session.user.user_metadata?.full_name ?? null,
            access_token: providerToken,
            refresh_token: providerRefreshToken ?? null,
            token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            scopes: providerType === 'spotify'
              ? 'playlist-read-private playlist-read-collaborative user-library-read'
              : 'https://www.googleapis.com/auth/youtube.readonly',
          },
          { onConflict: 'user_id,provider' }
        )
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', request.url))
}
