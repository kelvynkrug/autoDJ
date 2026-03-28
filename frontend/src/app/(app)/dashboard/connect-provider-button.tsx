'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'

const SCOPES: Record<string, string> = {
  spotify: 'playlist-read-private playlist-read-collaborative user-library-read',
  google: 'https://www.googleapis.com/auth/youtube.readonly',
}

export function ConnectProviderButton({ provider }: { provider: 'spotify' | 'google' }) {
  const handleConnect = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback?next=/dashboard`,
        scopes: SCOPES[provider],
      },
    })
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleConnect}>
      Conectar
    </Button>
  )
}
