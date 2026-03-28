'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'

const SCOPES: Record<string, string> = {
  spotify: 'playlist-read-private playlist-read-collaborative user-library-read',
  google: 'https://www.googleapis.com/auth/youtube.readonly openid email profile',
}

export function ConnectProviderButton({ provider }: { provider: 'spotify' | 'google' | 'deezer' }) {
  const handleConnect = async () => {
    if (provider === 'deezer') {
      const appId = process.env.NEXT_PUBLIC_DEEZER_APP_ID
      const redirect = `${window.location.origin}/deezer-callback`
      window.location.href = `https://connect.deezer.com/oauth/auth.php?app_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}&perms=basic_access,manage_library`
      return
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback?next=/dashboard`,
        scopes: SCOPES[provider],
        queryParams: { prompt: 'consent' },
      },
    })
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleConnect}>
      Conectar
    </Button>
  )
}
