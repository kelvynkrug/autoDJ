'use client'

import { useState, useCallback } from 'react'
import type { Playlist } from '@/lib/types'

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPlaylists = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/playlists')
      if (!res.ok) throw new Error('Falha ao buscar playlists')
      const data = await res.json()
      setPlaylists(data.playlists ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const importPlaylist = useCallback(
    async (provider: string, externalId: string) => {
      setError(null)
      try {
        const res = await fetch('/api/playlists/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, externalId }),
        })
        if (!res.ok) throw new Error('Falha ao importar playlist')
        await fetchPlaylists()
      } catch (err) {
        setError((err as Error).message)
      }
    },
    [fetchPlaylists],
  )

  return {
    playlists,
    loading,
    error,
    fetchPlaylists,
    importPlaylist,
  }
}
