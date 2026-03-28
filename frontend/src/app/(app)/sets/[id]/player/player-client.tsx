'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { NowPlaying } from '@/components/player/now-playing'
import { PlayerControls } from '@/components/player/player-controls'
import { VolumeControl } from '@/components/player/volume-control'
import { TrackProgress } from '@/components/player/track-progress'
import { EffectsPad } from '@/components/player/effects-pad'
import type { DJSet, TransitionType } from '@/lib/types'

function TransitionCountdown({ durationMs, transitionBeats }: { durationMs: number; transitionBeats: number }) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.floor(durationMs / 1000))

  useEffect(() => {
    setSecondsLeft(Math.floor(durationMs / 1000))
  }, [durationMs])

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (secondsLeft <= 0) return null

  const isClose = secondsLeft <= 30

  return (
    <div className={`mx-auto w-fit rounded-full px-4 py-2 text-center ${isClose ? 'bg-violet-600/20 animate-pulse' : 'bg-violet-600/10'}`}>
      <p className="text-xs text-violet-400">
        Transicao em <span className="font-mono font-bold">{secondsLeft}</span> segundos
      </p>
    </div>
  )
}

import type { PlayableTrack } from '@/lib/audio/types'
import { usePlayerStore } from '@/lib/stores/player-store'
import {
  getOrCreateEngine,
  getOrCreateEffects,
  isEngineInitialized,
  setEngineInitialized,
  destroyEngine,
} from '@/lib/audio/singleton'

async function fetchAudioUrl(trackId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/tracks/${trackId}/audio-url`)
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.url ?? null
  } catch {
    return null
  }
}

export function PlayerClient({ set }: { set: DJSet }) {
  const [isLoading, setIsLoading] = useState(true)
  const [playableTracks, setPlayableTracks] = useState<PlayableTrack[]>([])
  const [pendingTrackIndex, setPendingTrackIndex] = useState<number | null>(null)
  const [showTransitionPicker, setShowTransitionPicker] = useState(false)

  const {
    isPlaying,
    currentTrackIndex,
    volume,
    activeSetId,
    play: storePlay,
    pause: storePause,
    setCurrentTrackIndex,
    setTracks: setStoreTracks,
    setVolume: setStoreVolume,
  } = usePlayerStore()

  const currentTrack = set.tracks[currentTrackIndex]
  const nextTrack = set.tracks[currentTrackIndex + 1]

  // Buscar audio URLs para todas as tracks ready
  useEffect(() => {
    let cancelled = false

    async function loadAudioUrls() {
      const readyTracks = set.tracks.filter((t) => t.status === 'ready')

      if (readyTracks.length === 0) {
        setIsLoading(false)
        return
      }

      const results = await Promise.all(
        readyTracks.map(async (track) => {
          const audioUrl = await fetchAudioUrl(track.id)
          return { ...track, audioUrl: audioUrl ?? '', outroStartS: null } as PlayableTrack
        }),
      )

      if (cancelled) return

      const validTracks = results.filter((t) => t.audioUrl !== '')
      setPlayableTracks(validTracks)
      setIsLoading(false)
    }

    loadAudioUrls()
    return () => { cancelled = true }
  }, [set.tracks])

  // Inicializar AudioEngine via singleton
  useEffect(() => {
    if (playableTracks.length === 0) return

    // Se o engine ja esta inicializado para este mesmo set, so sincronizar estado
    if (isEngineInitialized() && activeSetId === set.id) {
      const engine = getOrCreateEngine()
      if (engine.isPlaying) {
        storePlay()
      }
      return
    }

    // Set diferente ou primeira vez: destruir o anterior e criar novo
    if (isEngineInitialized() && activeSetId !== set.id) {
      destroyEngine()
    }

    const engine = getOrCreateEngine()
    engine.setTracks(playableTracks)

    engine.onTrackChange = (index) => {
      setCurrentTrackIndex(index)
    }

    engine.onSetEnd = () => {
      storePause()
    }

    engine.onError = (error) => {
      console.error('[AudioEngine]', error.message)
    }

    setStoreTracks(set.tracks, set.id)
    setEngineInitialized(true)

    // NAO destruir no cleanup — o singleton sobrevive a re-renders
  }, [playableTracks, set.id, set.tracks, activeSetId, storePlay, storePause, setCurrentTrackIndex, setStoreTracks])

  // Sincronizar volume com engine
  useEffect(() => {
    if (!isEngineInitialized()) return
    const engine = getOrCreateEngine()
    engine.setVolume(volume)
  }, [volume])

  const handleToggle = useCallback(async () => {
    const engine = getOrCreateEngine()

    if (isPlaying) {
      engine.pause()
      storePause()
    } else {
      await engine.play()
      storePlay()
    }
  }, [isPlaying, storePlay, storePause])

  const handleEffect = useCallback((effectId: string) => {
    const effects = getOrCreateEffects()
    const engine = getOrCreateEngine()
    if (!effects) return

    const ctx = engine.getContext()
    const masterGain = engine.getMasterGain()

    switch (effectId) {
      case 'siren': {
        const now1 = ctx.currentTime
        masterGain.gain.setValueAtTime(masterGain.gain.value, now1)
        masterGain.gain.linearRampToValueAtTime(0.15, now1 + 0.1)
        effects.playSiren(masterGain, 1.5)
        masterGain.gain.setValueAtTime(0.15, now1 + 1.5)
        masterGain.gain.linearRampToValueAtTime(1.0, now1 + 2.0)
        break
      }
      case 'horn': {
        const now2 = ctx.currentTime
        masterGain.gain.setValueAtTime(masterGain.gain.value, now2)
        masterGain.gain.linearRampToValueAtTime(0.15, now2 + 0.1)
        effects.playAirHorn(masterGain, 3)
        masterGain.gain.setValueAtTime(0.15, now2 + 0.8)
        masterGain.gain.linearRampToValueAtTime(1.0, now2 + 1.3)
        break
      }
      case 'rewind': {
        const source = engine.getActiveDeckSource()
        if (source) effects.applyRewind(source, 2)
        break
      }
      case 'brake': {
        const source = engine.getActiveDeckSource()
        if (source) {
          effects.applyBrake(source, 1.5)
          setTimeout(() => {
            storePause()
          }, 1500)
        }
        break
      }
      case 'echo': {
        const deck = engine.getActiveDeckPublic()
        effects.applyEchoOut(deck, 8, 128)
        break
      }
      case 'riser':
        effects.playRiser(masterGain, 3)
        break
      case 'crowd': {
        const now = ctx.currentTime
        masterGain.gain.cancelScheduledValues(now)
        masterGain.gain.setValueAtTime(masterGain.gain.value, now)
        masterGain.gain.linearRampToValueAtTime(0.005, now + 0.3)
        masterGain.gain.setValueAtTime(0.005, now + 4.0)
        masterGain.gain.linearRampToValueAtTime(1.0, now + 5.0)
        break
      }
      case 'filter': {
        const deck = engine.getActiveDeckPublic()
        const deckOutput = deck.getOutput()
        const filter = ctx.createBiquadFilter()
        filter.type = 'highpass'
        filter.Q.value = 1

        deckOutput.connect(filter)
        filter.connect(masterGain)

        const now = ctx.currentTime
        filter.frequency.setValueAtTime(20, now)
        filter.frequency.exponentialRampToValueAtTime(4000, now + 1)
        filter.frequency.setValueAtTime(4000, now + 2)
        filter.frequency.exponentialRampToValueAtTime(20, now + 3)

        setTimeout(() => {
          try {
            deckOutput.disconnect(filter)
            filter.disconnect()
          } catch {
            // nos podem ja ter sido desconectados
          }
        }, 3500)
        break
      }
    }
  }, [storePause])

  const handleSkip = useCallback(async () => {
    const engine = getOrCreateEngine()
    await engine.skip()
  }, [])

  const handleTrackSelect = useCallback(async (index: number) => {
    setCurrentTrackIndex(index)

    if (playableTracks.length === 0) return

    // Destroi e recria o engine para o novo ponto de partida
    destroyEngine()

    const slicedTracks = playableTracks.slice(index)
    const engine = getOrCreateEngine()
    engine.setTracks(slicedTracks)

    engine.onTrackChange = (i) => {
      setCurrentTrackIndex(index + i)
    }
    engine.onSetEnd = () => storePause()
    engine.onError = (error) => console.error('[AudioEngine]', error.message)

    setEngineInitialized(true)

    if (isPlaying) {
      await engine.play()
    }
  }, [playableTracks, isPlaying, setCurrentTrackIndex, storePause])

  const handleTrackClick = useCallback((index: number) => {
    if (index === currentTrackIndex) return

    if (!isPlaying) {
      handleTrackSelect(index)
      return
    }

    setPendingTrackIndex(index)
    setShowTransitionPicker(true)
  }, [isPlaying, currentTrackIndex, handleTrackSelect])

  const handleTransitionChoice = useCallback(async (transitionType: string) => {
    setShowTransitionPicker(false)

    if (pendingTrackIndex === null) return

    if (transitionType === 'instant') {
      await handleTrackSelect(pendingTrackIndex)
      setPendingTrackIndex(null)
      return
    }

    const engine = getOrCreateEngine()
    if (!isEngineInitialized()) {
      await handleTrackSelect(pendingTrackIndex)
      setPendingTrackIndex(null)
      return
    }

    const targetPlayableIndex = playableTracks.findIndex(
      (t) => t.id === set.tracks[pendingTrackIndex]?.id,
    )

    if (targetPlayableIndex === -1) {
      await handleTrackSelect(pendingTrackIndex)
      setPendingTrackIndex(null)
      return
    }

    try {
      await engine.skipToWithTransition(targetPlayableIndex, transitionType as TransitionType)
    } catch (error) {
      console.error('[PlayerClient] Falha na transicao:', error)
      await handleTrackSelect(pendingTrackIndex)
    }

    setPendingTrackIndex(null)
  }, [pendingTrackIndex, handleTrackSelect, playableTracks, set.tracks])

  if (!currentTrack) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">Este set nao possui faixas.</p>
          <Link
            href={`/sets/${set.id}`}
            className="mt-4 inline-flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            Voltar para Set
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col lg:flex-row gap-6">
      <div className="flex flex-1 flex-col items-center justify-center">
        <Link
          href={`/sets/${set.id}`}
          className="self-start inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-8"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Voltar para Set
        </Link>

        <div className="w-full max-w-md space-y-8">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              <span className="ml-3 text-sm text-zinc-400">Carregando audio...</span>
            </div>
          )}

          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-zinc-800 shadow-2xl shadow-black/50">
            {currentTrack.coverUrl ? (
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className={`h-full w-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-600">
                <svg className="h-24 w-24" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            )}
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-100">{currentTrack.title}</h1>
            <p className="mt-1 text-zinc-400">{currentTrack.artist}</p>
            <div className="mt-3 flex items-center justify-center gap-3 text-xs text-zinc-500">
              <span className="font-mono">{currentTrack.analysis?.bpm ?? currentTrack.bpmAdjusted} BPM</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="font-mono">{currentTrack.analysis?.camelot ?? '---'}</span>
            </div>
          </div>

          <TrackProgress
            key={currentTrack.id}
            durationMs={currentTrack.durationMs}
            isPlaying={isPlaying}
            onSeek={(ms) => {
              if (!isEngineInitialized()) return
              const engine = getOrCreateEngine()
              engine.seek(ms / 1000)
            }}
          />

          <div className="flex items-center justify-center gap-6">
            <VolumeControl
              volume={volume}
              onVolumeChange={(v) => {
                setStoreVolume(v)
              }}
            />
            <PlayerControls
              isPlaying={isPlaying}
              onToggle={handleToggle}
              onSkip={handleSkip}
              size="lg"
            />
          </div>

          <EffectsPad
            onEffect={handleEffect}
            disabled={!isPlaying || playableTracks.length === 0}
          />

          {playableTracks.length === 0 && !isLoading && (
            <div className="rounded-lg border border-yellow-800/50 bg-yellow-900/20 p-3 text-center">
              <p className="text-xs text-yellow-400">
                Nenhuma faixa com audio disponivel. As tracks precisam ser processadas primeiro.
              </p>
            </div>
          )}

          {isPlaying && nextTrack && <TransitionCountdown durationMs={currentTrack.durationMs} transitionBeats={set.transitionBeats ?? 16} />}

          {nextTrack && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500 mb-2">Proxima faixa</p>
              <NowPlaying track={nextTrack} size="sm" />
            </div>
          )}
        </div>
      </div>

      <div className="relative lg:w-80 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-4 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">
          {set.name} --- {set.tracks.length} faixas
        </h3>
        <div className="space-y-1">
          {set.tracks.map((track, i) => {
            const isCurrent = i === currentTrackIndex
            return (
              <button
                key={track.id}
                onClick={() => handleTrackClick(i)}
                className={`
                  w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all cursor-pointer
                  ${isCurrent ? 'bg-violet-600/15 border border-violet-500/30' : 'hover:bg-zinc-800/60 border border-transparent'}
                `}
              >
                <span className={`text-xs tabular-nums w-5 text-right ${isCurrent ? 'text-violet-400' : 'text-zinc-600'}`}>
                  {i + 1}
                </span>
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-zinc-800">
                  {track.coverUrl ? (
                    <img src={track.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-zinc-800" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${isCurrent ? 'font-medium text-violet-300' : 'text-zinc-300'}`}>
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-zinc-600">{track.artist}</p>
                </div>
                {isCurrent && isPlaying && (
                  <div className="flex items-end gap-0.5 h-3">
                    <div className="w-0.5 h-full bg-violet-500 animate-pulse rounded-full" />
                    <div className="w-0.5 h-2/3 bg-violet-500 animate-pulse rounded-full" style={{ animationDelay: '0.15s' }} />
                    <div className="w-0.5 h-full bg-violet-500 animate-pulse rounded-full" style={{ animationDelay: '0.3s' }} />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {showTransitionPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => { setShowTransitionPicker(false); setPendingTrackIndex(null) }}
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl min-w-[280px]">
              <p className="text-sm text-zinc-300 mb-3 text-center">
                Transicao para: <span className="text-violet-400">{pendingTrackIndex !== null ? set.tracks[pendingTrackIndex]?.title : ''}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'crossfade', label: 'Crossfade', desc: 'Suave' },
                  { id: 'eq_swap', label: 'EQ Swap', desc: 'Troca graves' },
                  { id: 'filter_sweep', label: 'Filter', desc: 'Filtro' },
                  { id: 'rewind', label: 'Rewind', desc: 'Rebobina' },
                  { id: 'buildup_drop', label: 'Build & Drop', desc: 'Sobe e dropa' },
                  { id: 'echo_out', label: 'Echo Out', desc: 'Eco sumindo' },
                  { id: 'brake', label: 'Brake', desc: 'Freia disco' },
                  { id: 'instant', label: 'Direto', desc: 'Sem transicao' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTransitionChoice(t.id)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-left hover:border-violet-500 hover:bg-violet-500/10 transition-colors"
                  >
                    <p className="text-xs font-medium text-zinc-200">{t.label}</p>
                    <p className="text-[10px] text-zinc-500">{t.desc}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setShowTransitionPicker(false); setPendingTrackIndex(null) }}
                className="mt-2 w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
