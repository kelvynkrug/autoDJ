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

      // Detect which provider was just authenticated
      const identities = session.user.identities ?? []
      const latestIdentity = identities.sort(
        (a, b) =>
          new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
      )[0]
      const providerType = (
        latestIdentity?.provider === 'google' ? 'google'
        : latestIdentity?.provider === 'spotify' ? 'spotify'
        : session.user.app_metadata?.provider
      ) as 'spotify' | 'google'

      // Save provider token if available
      if (providerToken) {
        await supabase.from('provider_connections').upsert(
          {
            user_id: session.user.id,
            provider: providerType,
            provider_user_id: latestIdentity?.id ?? session.user.id,
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
      } else {
        // provider_token is null — this happens when linking a second provider
        // Redirect to a re-auth flow that forces a fresh token
        const redirectUrl = new URL(next, request.url)
        redirectUrl.searchParams.set('linked', providerType)
        return NextResponse.redirect(redirectUrl)
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', request.url))
}
