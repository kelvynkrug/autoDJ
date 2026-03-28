'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PlaylistCard } from '@/components/playlist/playlist-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Playlist } from '@/lib/types'

type Tab = 'mine' | 'spotify' | 'youtube'

export default function PlaylistsPage() {
  const [tab, setTab] = useState<Tab>('mine')
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([])
  const [providerPlaylists, setProviderPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [providerLoading, setProviderLoading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectedProviders, setConnectedProviders] = useState<string[]>([])

  const supabase = createClient()

  useEffect(() => {
    loadMyPlaylists()
    loadProviders()
  }, [])

  useEffect(() => {
    if (tab === 'spotify' || tab === 'youtube') {
      loadProviderPlaylists(tab === 'spotify' ? 'spotify' : 'google')
    }
  }, [tab])

  async function loadProviders() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setConnectedProviders(user.app_metadata?.providers ?? [])
    }
  }

  async function loadMyPlaylists() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('playlists')
      .select('id, name, track_count, provider, cover_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setMyPlaylists(
      (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        trackCount: r.track_count,
        provider: r.provider,
        coverUrl: r.cover_url,
      }))
    )
    setLoading(false)
  }

  async function loadProviderPlaylists(provider: 'spotify' | 'google') {
    setProviderLoading(true)
    setError(null)
    setProviderPlaylists([])

    try {
      const res = await fetch(`/api/playlists/providers/${provider}`)
      const json = await res.json()

      if (!res.ok) {
        setError(json.error?.message ?? 'Erro ao buscar playlists')
        return
      }

      setProviderPlaylists(json.data ?? [])
    } catch {
      setError('Erro de conexao. Tente novamente.')
    } finally {
      setProviderLoading(false)
    }
  }

  async function handleImport(playlist: Playlist) {
    setImporting(playlist.id)
    try {
      const provider = tab === 'spotify' ? 'spotify' : 'google'
      const res = await fetch('/api/playlists/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          providerPlaylistId: playlist.id,
        }),
      })

      if (res.ok) {
        await loadMyPlaylists()
        setTab('mine')
      } else {
        const json = await res.json()
        setError(json.error?.message ?? 'Erro ao importar')
      }
    } catch {
      setError('Erro ao importar playlist')
    } finally {
      setImporting(null)
    }
  }

  const tabs: { key: Tab; label: string; provider?: string }[] = [
    { key: 'mine', label: 'Minhas Playlists' },
    { key: 'spotify', label: 'Importar do Spotify', provider: 'spotify' },
    { key: 'youtube', label: 'Importar do YouTube', provider: 'google' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Playlists</h1>
          <p className="mt-1 text-zinc-400">Gerencie e importe suas playlists</p>
        </div>
        <Link href="/playlists/create">
          <Button variant="primary" size="md">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Criar por gosto
          </Button>
        </Link>
      </div>

      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-violet-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            fechar
          </button>
        </div>
      )}

      {tab === 'mine' && (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : myPlaylists.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
            <svg className="h-12 w-12 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
            <p className="mt-4 text-zinc-400">Nenhuma playlist importada</p>
            <p className="mt-1 text-sm text-zinc-600">
              Importe do Spotify/YouTube ou crie uma do zero por gostos musicais.
            </p>
            <Link href="/playlists/create" className="mt-4">
              <Button variant="primary" size="sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                Criar playlist por gosto
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myPlaylists.map((pl) => (
              <PlaylistCard key={pl.id} playlist={pl} />
            ))}
          </div>
        )
      )}

      {(tab === 'spotify' || tab === 'youtube') && (
        (() => {
          const provider = tab === 'spotify' ? 'spotify' : 'google'
          const isConnected = connectedProviders.includes(provider)
          const providerName = tab === 'spotify' ? 'Spotify' : 'YouTube'

          if (!isConnected) {
            return (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
                <p className="text-zinc-400">{providerName} nao conectado</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Conecte sua conta no Dashboard para importar playlists.
                </p>
                <a href="/dashboard" className="mt-4">
                  <Button variant="primary" size="sm">Ir para Dashboard</Button>
                </a>
              </div>
            )
          }

          if (providerLoading) {
            return (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                <p className="text-sm text-zinc-400">Buscando playlists do {providerName}...</p>
              </div>
            )
          }

          if (providerPlaylists.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
                <p className="text-zinc-400">Nenhuma playlist encontrada no {providerName}</p>
              </div>
            )
          }

          return (
            <div className="space-y-3">
              {providerPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {pl.coverUrl && (
                      <img
                        src={pl.coverUrl}
                        alt=""
                        className="h-10 w-10 rounded object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100">{pl.name}</p>
                      <p className="text-xs text-zinc-500">{pl.trackCount} faixas</p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleImport(pl)}
                    disabled={importing !== null}
                  >
                    {importing === pl.id ? (
                      <span className="flex items-center gap-2">
                        <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                        Importando...
                      </span>
                    ) : (
                      'Importar'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )
        })()
      )}
    </div>
  )
}
