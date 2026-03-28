'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function NewSetPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>}>
      <NewSetPage />
    </Suspense>
  )
}

function NewSetPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const playlistId = searchParams.get('playlist')

  const [name, setName] = useState('')
  const [playlistName, setPlaylistName] = useState('')
  const [transitionType, setTransitionType] = useState('crossfade')
  const [transitionBeats, setTransitionBeats] = useState(16)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (playlistId) {
      supabase
        .from('playlists')
        .select('name')
        .eq('id', playlistId)
        .single()
        .then(({ data }) => {
          if (data) {
            setPlaylistName(data.name)
            setName(`Set - ${data.name}`)
          }
        })
    }
  }, [playlistId])

  async function handleCreate() {
    if (!playlistId || !name.trim()) return
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistId,
          name: name.trim(),
          autoOrder: true,
          transitionType,
          transitionBeats,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        router.push(`/sets/${json.data.id}`)
      } else {
        setError(json.error?.message ?? 'Erro ao criar set')
      }
    } catch {
      setError('Erro de conexao')
    } finally {
      setCreating(false)
    }
  }

  if (!playlistId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-zinc-400">Selecione uma playlist primeiro.</p>
        <Button variant="primary" className="mt-4" onClick={() => router.push('/playlists')}>
          Ir para Playlists
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Novo Set</h1>
        <p className="mt-1 text-zinc-400">
          Criando set a partir de <span className="text-zinc-200">{playlistName || '...'}</span>
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Nome do Set</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            placeholder="Ex: Festa de Aniversário"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Tipo de Transição</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'crossfade', label: 'Crossfade', desc: 'Suave' },
              { value: 'eq_swap', label: 'EQ Swap', desc: 'Troca graves' },
              { value: 'filter_sweep', label: 'Filter Sweep', desc: 'Filtro' },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setTransitionType(t.value)}
                className={`rounded-lg border px-3 py-3 text-center transition-colors ${
                  transitionType === t.value
                    ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs mt-0.5 opacity-60">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Duração da Transição: {transitionBeats} beats
          </label>
          <input
            type="range"
            min={4}
            max={32}
            step={4}
            value={transitionBeats}
            onChange={(e) => setTransitionBeats(Number(e.target.value))}
            className="w-full accent-violet-500"
          />
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>4 beats</span>
            <span>16 beats</span>
            <span>32 beats</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleCreate}
          disabled={creating || !name.trim()}
        >
          {creating ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Criando...
            </span>
          ) : (
            'Criar Set'
          )}
        </Button>
      </div>
    </div>
  )
}
