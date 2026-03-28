'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

const TOTAL_STEPS = 5

const GENRES = [
  { id: 'pop', label: 'Pop' },
  { id: 'rock', label: 'Rock' },
  { id: 'eletronica', label: 'Eletronica' },
  { id: 'hip-hop', label: 'Hip Hop' },
  { id: 'rnb', label: 'R&B' },
  { id: 'funk', label: 'Funk' },
  { id: 'sertanejo', label: 'Sertanejo' },
  { id: 'reggaeton', label: 'Reggaeton' },
  { id: 'jazz', label: 'Jazz' },
  { id: 'lofi', label: 'Lo-fi' },
  { id: 'indie', label: 'Indie' },
  { id: 'metal', label: 'Metal' },
  { id: 'mpb', label: 'MPB' },
  { id: 'pagode', label: 'Pagode' },
  { id: 'forro', label: 'Forro' },
  { id: 'kpop', label: 'K-Pop' },
] as const

const MOODS = [
  { id: 'animada', label: 'Animada', description: 'Festa, energia alta' },
  { id: 'chill', label: 'Chill', description: 'Relaxado, ambiente' },
  { id: 'romantica', label: 'Romantica', description: 'Love songs' },
  { id: 'workout', label: 'Workout', description: 'Treino, motivacao' },
  { id: 'nostalgica', label: 'Nostalgica', description: 'Classicos, throwbacks' },
] as const

const DECADES = [
  { id: '2020s', label: '2020s' },
  { id: '2010s', label: '2010s' },
  { id: '2000s', label: '2000s' },
  { id: '90s', label: '90s' },
  { id: '80s', label: '80s' },
  { id: 'qualquer', label: 'Qualquer epoca' },
] as const

interface TrackSuggestion {
  title: string
  artist: string
  spotifyId?: string
  youtubeId?: string
  thumbnailUrl: string | null
  durationMs: number
  album: string
}

export default function CreatePlaylistPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [genres, setGenres] = useState<string[]>([])
  const [mood, setMood] = useState<string>('')
  const [decades, setDecades] = useState<string[]>([])
  const [count, setCount] = useState(20)
  const [tracks, setTracks] = useState<TrackSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleGenre(id: string) {
    setGenres((prev) => {
      if (prev.includes(id)) return prev.filter((g) => g !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  function toggleDecade(id: string) {
    setDecades((prev) => {
      if (prev.includes(id)) return prev.filter((d) => d !== id)
      return [...prev, id]
    })
  }

  function removeTrack(index: number) {
    setTracks((prev) => prev.filter((_, i) => i !== index))
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1: return genres.length >= 1
      case 2: return mood !== ''
      case 3: return decades.length >= 1
      case 4: return true
      default: return false
    }
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setStep(5)

    try {
      const res = await fetch('/api/playlists/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genres, mood, decades, count }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error?.message ?? 'Erro ao gerar sugestoes')
        return
      }

      setTracks(json.data.tracks ?? [])
    } catch {
      setError('Erro de conexao. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (tracks.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Sessao expirada. Faca login novamente.')
        return
      }

      const moodLabels: Record<string, string> = {
        animada: 'Animada',
        chill: 'Chill',
        romantica: 'Romantica',
        workout: 'Workout',
        nostalgica: 'Nostalgica',
      }
      const playlistName = `${moodLabels[mood] ?? mood} Mix — ${genres.map((g) => GENRES.find((x) => x.id === g)?.label ?? g).join(', ')}`

      const { data: playlist, error: playlistError } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          name: playlistName,
          provider: null,
          provider_playlist_id: null,
          track_count: tracks.length,
          cover_url: tracks[0]?.thumbnailUrl ?? null,
        })
        .select('id')
        .single()

      if (playlistError || !playlist) {
        setError(playlistError?.message ?? 'Erro ao criar playlist')
        return
      }

      const tracksToInsert = tracks.map((t, index) => ({
        playlist_id: playlist.id,
        provider_track_id: t.spotifyId ?? t.youtubeId ?? null,
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration_ms: t.durationMs,
        cover_url: t.thumbnailUrl,
        position: index,
        status: 'pending' as const,
      }))

      const { error: tracksError } = await supabase
        .from('tracks')
        .insert(tracksToInsert)

      if (tracksError) {
        setError(tracksError.message)
        return
      }

      router.push(`/playlists/${playlist.id}`)
    } catch {
      setError('Erro ao salvar playlist')
    } finally {
      setSaving(false)
    }
  }

  function handleNext() {
    if (step === 4) {
      handleGenerate()
    } else {
      setStep((s) => s + 1)
    }
  }

  function handleBack() {
    if (step === 5 && !loading) {
      setStep(4)
      setTracks([])
      setError(null)
    } else if (step > 1) {
      setStep((s) => s - 1)
    }
  }

  function formatDuration(ms: number): string {
    if (!ms) return '--:--'
    const min = Math.floor(ms / 60000)
    const sec = Math.floor((ms % 60000) / 1000)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => step === 1 ? router.push('/playlists') : handleBack()}
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {step === 1 ? 'Voltar para Playlists' : 'Voltar'}
      </button>

      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Criar Playlist por Gosto</h1>
        <p className="mt-1 text-zinc-400">
          Responda algumas perguntas e encontraremos musicas pra voce
        </p>
      </div>

      {/* Step indicator */}
      {step <= 4 && (
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  i + 1 === step
                    ? 'bg-violet-600 text-white'
                    : i + 1 < step
                      ? 'bg-violet-600/20 text-violet-400'
                      : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {i + 1 < step ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div
                  className={`h-0.5 w-8 transition-colors ${
                    i + 1 < step ? 'bg-violet-600/40' : 'bg-zinc-800'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            fechar
          </button>
        </div>
      )}

      {/* Step 1 — Generos */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Quais generos voce curte?</h2>
            <p className="text-sm text-zinc-500">Selecione de 1 a 5 generos</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {GENRES.map((g) => {
              const selected = genres.includes(g.id)
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.id)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
                    selected
                      ? 'border-violet-500 bg-violet-500/10 text-violet-300 shadow-lg shadow-violet-500/10'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/80'
                  }`}
                >
                  {g.label}
                </button>
              )
            })}
          </div>
          {genres.length >= 5 && (
            <p className="text-xs text-amber-400">Maximo de 5 generos atingido</p>
          )}
        </div>
      )}

      {/* Step 2 — Mood */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Qual a vibe?</h2>
            <p className="text-sm text-zinc-500">Escolha o clima da playlist</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {MOODS.map((m) => {
              const selected = mood === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setMood(m.id)}
                  className={`flex flex-col items-start rounded-xl border px-4 py-4 text-left transition-all cursor-pointer ${
                    selected
                      ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/80'
                  }`}
                >
                  <span className={`font-medium ${selected ? 'text-violet-300' : 'text-zinc-200'}`}>
                    {m.label}
                  </span>
                  <span className="mt-1 text-xs text-zinc-500">{m.description}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 3 — Decadas */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">De qual epoca?</h2>
            <p className="text-sm text-zinc-500">Selecione uma ou mais decadas</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {DECADES.map((d) => {
              const selected = decades.includes(d.id)
              return (
                <button
                  key={d.id}
                  onClick={() => toggleDecade(d.id)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
                    selected
                      ? 'border-violet-500 bg-violet-500/10 text-violet-300 shadow-lg shadow-violet-500/10'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/80'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 4 — Quantidade */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Quantas faixas?</h2>
            <p className="text-sm text-zinc-500">Escolha a quantidade de musicas</p>
          </div>
          <div className="max-w-md space-y-4">
            <Slider
              value={count}
              min={10}
              max={50}
              step={5}
              onChange={setCount}
              label="Numero de faixas"
            />
            <p className="text-center text-3xl font-bold tabular-nums text-violet-400">{count}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <p className="text-sm font-medium text-zinc-300">Resumo</p>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-violet-300">
                {genres.map((g) => GENRES.find((x) => x.id === g)?.label).join(', ')}
              </span>
              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-violet-300">
                {MOODS.find((m) => m.id === mood)?.label}
              </span>
              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-violet-300">
                {decades.map((d) => DECADES.find((x) => x.id === d)?.label).join(', ')}
              </span>
              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-violet-300">
                {count} faixas
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Step 5 — Resultado */}
      {step === 5 && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              <p className="text-zinc-400">Buscando musicas...</p>
              <p className="text-xs text-zinc-600">Isso pode levar alguns segundos</p>
            </div>
          ) : tracks.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
              <p className="text-zinc-400">Nenhuma musica encontrada</p>
              <p className="mt-1 text-sm text-zinc-600">Tente ajustar seus filtros</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={handleBack}>
                Voltar e ajustar
              </Button>
            </div>
          ) : tracks.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">
                  {tracks.length} faixas encontradas
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSave}
                  disabled={saving || tracks.length === 0}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                      Salvando...
                    </span>
                  ) : (
                    'Criar Playlist'
                  )}
                </Button>
              </div>

              <div className="divide-y divide-zinc-800/50 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                {tracks.map((track, i) => (
                  <div
                    key={`${track.spotifyId ?? track.youtubeId ?? i}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="w-6 text-right text-xs tabular-nums text-zinc-500">
                      {i + 1}
                    </span>
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
                      {track.thumbnailUrl ? (
                        <img
                          src={track.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-600">
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">{track.title}</p>
                      <p className="truncate text-xs text-zinc-500">{track.artist}</p>
                    </div>
                    <span className="text-xs tabular-nums text-zinc-500">
                      {formatDuration(track.durationMs)}
                    </span>
                    <button
                      onClick={() => removeTrack(i)}
                      className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
                      title="Remover faixa"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleSave}
                  disabled={saving || tracks.length === 0}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                      Salvando...
                    </span>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Criar Playlist
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Navigation buttons */}
      {step <= 4 && (
        <div className="flex justify-between pt-4">
          <Button
            variant="ghost"
            size="md"
            onClick={handleBack}
            disabled={step === 1}
          >
            Voltar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleNext}
            disabled={!canAdvance()}
          >
            {step === 4 ? 'Gerar Playlist' : 'Proximo'}
          </Button>
        </div>
      )}
    </div>
  )
}
