'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'

const SCOPES: Record<string, string> = {
  spotify: 'playlist-read-private playlist-read-collaborative user-library-read',
  google: 'https://www.googleapis.com/auth/youtube.readonly openid email profile',
}

export function ConnectProviderButton({ provider }: { provider: 'spotify' | 'google' }) {
  const handleConnect = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Use linkIdentity to connect a second provider (preserves existing session)
    // This returns provider_token properly
    const { data } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback?next=/dashboard`,
        scopes: SCOPES[provider],
      },
    })

    // linkIdentity returns a URL to redirect to
    if (data?.url) {
      window.location.href = data.url
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleConnect}>
      Conectar
    </Button>
  )
}
