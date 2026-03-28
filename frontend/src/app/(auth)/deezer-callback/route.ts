import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=deezer_no_code', origin))
  }

  const appId = process.env.NEXT_PUBLIC_DEEZER_APP_ID
  const secret = process.env.DEEZER_SECRET

  if (!appId || !secret) {
    return NextResponse.redirect(new URL('/login?error=deezer_config', origin))
  }

  try {
    const tokenRes = await fetch(
      `https://connect.deezer.com/oauth/access_token.php?app_id=${appId}&secret=${secret}&code=${code}&output=json`,
    )

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL('/login?error=deezer_token', origin))
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return NextResponse.redirect(new URL('/login?error=deezer_token', origin))
    }

    const profileRes = await fetch(`https://api.deezer.com/user/me?access_token=${accessToken}`)
    const profile = await profileRes.json()

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=not_authenticated', origin))
    }

    await supabase.from('provider_connections').upsert(
      {
        user_id: user.id,
        provider: 'deezer',
        provider_user_id: String(profile.id ?? ''),
        display_name: profile.name ?? null,
        access_token: accessToken,
        refresh_token: null,
        token_expires_at: null,
        scopes: 'basic_access,manage_library',
      },
      { onConflict: 'user_id,provider' },
    )

    return NextResponse.redirect(new URL('/dashboard', origin))
  } catch {
    return NextResponse.redirect(new URL('/login?error=deezer_error', origin))
  }
}
