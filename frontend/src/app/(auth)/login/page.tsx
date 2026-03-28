'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Provider } from '@/lib/types'

const SCOPES: Record<Provider, string> = {
  spotify: 'playlist-read-private playlist-read-collaborative user-library-read',
  google: 'https://www.googleapis.com/auth/youtube.readonly',
}

export default function LoginPage() {
  const [loading, setLoading] = useState<Provider | null>(null)

  async function handleLogin(provider: Provider) {
    setLoading(provider)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback`,
        scopes: SCOPES[provider],
      },
    })

    if (error) {
      setLoading(null)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            AutoDJ
          </h1>
          <p className="text-center text-sm text-zinc-400">
            Transforme sua playlist em um set profissional
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <button
            onClick={() => handleLogin('spotify')}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#1DB954] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <SpotifyIcon />
            {loading === 'spotify' ? 'Conectando...' : 'Entrar com Spotify'}
          </button>

          <button
            onClick={() => handleLogin('google')}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <GoogleIcon />
            {loading === 'google' ? 'Conectando...' : 'Entrar com Google'}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-600">
          YouTube e YouTube Music via conta Google
        </p>
      </div>
    </main>
  )
}

function SpotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
