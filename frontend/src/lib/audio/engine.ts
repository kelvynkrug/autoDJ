import type { TransitionType } from '@/lib/types'
import { Deck } from './deck'
import { CrossfaderNode } from './crossfader'
import {
  crossfadeTransition,
  eqSwapTransition,
  filterSweepTransition,
  rewindTransition,
  buildupDropTransition,
  echoOutTransition,
  brakeTransition,
} from './transitions'
import { beatsToSeconds, getTransitionStartTime } from './utils'
import type { PlayableTrack } from './types'

const PRELOAD_AHEAD_S = 30
const TICK_INTERVAL_MS = 250

/**
 * AudioEngine gerencia o contexto de áudio, dois decks e o crossfader.
 * Responsável por pré-carregar faixas e orquestrar transições automáticas.
 *
 * Grafo de áudio:
 *   Deck A -> CrossfaderNode.inputA -+
 *                                     +-> CrossfaderNode.output -> masterGain -> analyser -> destination
 *   Deck B -> CrossfaderNode.inputB -+
 */
export class AudioEngine {
  private context: AudioContext
  private deckA: Deck
  private deckB: Deck
  private crossfader: CrossfaderNode
  private masterGain: GainNode
  private analyser: AnalyserNode

  private activeDeck: 'A' | 'B' = 'A'
  private tracks: PlayableTrack[] = []
  private currentIndex: number = 0
  private _isPlaying: boolean = false
  private transitionScheduled: boolean = false
  private preloadScheduled: boolean = false
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private isTransitioning: boolean = false

  /** Chamado quando a faixa ativa muda. */
  onTrackChange?: (index: number, track: PlayableTrack) => void
  /** Chamado quando uma transição começa. */
  onTransitionStart?: (fromIndex: number, toIndex: number) => void
  /** Chamado quando o set termina. */
  onSetEnd?: () => void
  /** Chamado em caso de erro. */
  onError?: (error: Error) => void

  constructor() {
    this.context = new AudioContext()

    this.deckA = new Deck(this.context)
    this.deckB = new Deck(this.context)
    this.crossfader = new CrossfaderNode(this.context)
    this.masterGain = this.context.createGain()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 2048

    // Conecta o grafo
    this.deckA.connect(this.crossfader.getInputA())
    this.deckB.connect(this.crossfader.getInputB())
    this.crossfader.connect(this.masterGain)
    this.masterGain.connect(this.analyser)
    this.analyser.connect(this.context.destination)
  }

  /**
   * Inicializa o AudioContext (resume).
   * DEVE ser chamado em resposta a um user gesture (click, tap).
   */
  async initialize(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  /** Limpa todos os recursos: para decks, desconecta nós, fecha contexto. */
  destroy(): void {
    this.stopTick()
    this.deckA.stop()
    this.deckB.stop()
    this.deckA.disconnect()
    this.deckB.disconnect()
    this.crossfader.disconnect()
    this.masterGain.disconnect()
    this.analyser.disconnect()
    this._isPlaying = false

    if (this.context.state !== 'closed') {
      this.context.close()
    }
  }

  /**
   * Define a lista de faixas do set.
   * Reseta o estado para o início.
   */
  setTracks(tracks: PlayableTrack[]): void {
    this.tracks = tracks
    this.currentIndex = 0
    this.activeDeck = 'A'
    this.transitionScheduled = false
    this.preloadScheduled = false
    this.crossfader.setPosition(0)
  }

  /**
   * Inicia ou retoma a reprodução.
   * Carrega a primeira faixa se necessário.
   */
  async play(): Promise<void> {
    await this.initialize()

    if (this.tracks.length === 0) return

    const deck = this.getActiveDeck()

    if (!deck.getBuffer()) {
      const track = this.tracks[this.currentIndex]
      if (!track) return

      try {
        await this.loadTrack(deck, track)
      } catch (error) {
        this.handleLoadError(error as Error)
        return
      }
    }

    deck.play()
    this._isPlaying = true
    this.transitionScheduled = false
    this.preloadScheduled = false
    this.startTick()
    this.onTrackChange?.(this.currentIndex, this.tracks[this.currentIndex])
  }

  /** Pausa a reprodução do deck ativo. */
  pause(): void {
    this.getActiveDeck().pause()
    this._isPlaying = false
    this.stopTick()
  }

  /**
   * Pula para a próxima faixa executando uma transição.
   * Se não houver próxima, para a reprodução.
   */
  async skip(): Promise<void> {
    if (this.isTransitioning) return

    const nextIndex = this.currentIndex + 1
    if (nextIndex >= this.tracks.length) {
      this.getActiveDeck().stop()
      this._isPlaying = false
      this.stopTick()
      this.onSetEnd?.()
      return
    }

    const nextTrack = this.tracks[nextIndex]
    await this.executeTransition(nextTrack.transitionType)
  }

  /**
   * Define o volume master.
   * @param value 0 a 1
   */
  setVolume(value: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, value))
  }

  /** Retorna a posição atual de reprodução em segundos. */
  getCurrentTime(): number {
    return this.getActiveDeck().getCurrentTime()
  }

  /** Retorna a duração da faixa atual em segundos. */
  getDuration(): number {
    return this.getActiveDeck().getDuration()
  }

  /** Retorna dados do analyser para visualização (frequency data). */
  getAnalyserData(): Uint8Array {
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)
    return data
  }

  /** Indica se está reproduzindo. */
  get isPlaying(): boolean {
    return this._isPlaying
  }

  /** Retorna o índice da faixa atual. */
  getCurrentIndex(): number {
    return this.currentIndex
  }

  // ────────────────────────────────────────────────────────────────
  // Internos
  // ────────────────────────────────────────────────────────────────

  private getActiveDeck(): Deck {
    return this.activeDeck === 'A' ? this.deckA : this.deckB
  }

  private getInactiveDeck(): Deck {
    return this.activeDeck === 'A' ? this.deckB : this.deckA
  }

  private async loadTrack(deck: Deck, track: PlayableTrack): Promise<void> {
    if (!track.audioUrl) {
      throw new Error(`Track "${track.title}" não possui URL de áudio`)
    }
    await deck.loadFromUrl(track.audioUrl)
  }

  private handleLoadError(error: Error): void {
    this.onError?.(error)
    this.currentIndex++
    this.trySkipToNextValid()
  }

  /**
   * Loop de tick que monitora a posição do deck ativo
   * para agendar pré-carregamento e transições.
   */
  private startTick(): void {
    if (this.tickTimer) return

    this.tickTimer = setInterval(() => {
      if (!this._isPlaying) return
      this.checkPreload()
      this.checkTransition()
    }, TICK_INTERVAL_MS)
  }

  private stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  /**
   * Pré-carrega a próxima faixa quando faltam PRELOAD_AHEAD_S segundos.
   */
  private checkPreload(): void {
    if (this.preloadScheduled) return

    const nextIndex = this.currentIndex + 1
    if (nextIndex >= this.tracks.length) return

    const deck = this.getActiveDeck()
    const remaining = deck.getDuration() - deck.getCurrentTime()

    if (remaining <= PRELOAD_AHEAD_S) {
      this.preloadScheduled = true
      const inactiveDeck = this.getInactiveDeck()
      const nextTrack = this.tracks[nextIndex]

      this.loadTrack(inactiveDeck, nextTrack).catch((error) => {
        this.onError?.(new Error(`Falha ao pré-carregar "${nextTrack.title}": ${(error as Error).message}`))
      })
    }
  }

  /**
   * Verifica se é hora de iniciar a transição.
   * Usa o outroStartS da análise ou calcula baseado na duração.
   */
  private checkTransition(): void {
    if (this.transitionScheduled || this.isTransitioning) return

    const nextIndex = this.currentIndex + 1
    if (nextIndex >= this.tracks.length) return

    const currentTrack = this.tracks[this.currentIndex]
    const deck = this.getActiveDeck()
    const currentTime = deck.getCurrentTime()
    const duration = deck.getDuration()

    const bpm = currentTrack.analysis?.bpm ?? 120
    const transitionDurationS = beatsToSeconds(16, bpm)

    const outroStartS = currentTrack.outroStartS ?? null
    const transitionStartTime = getTransitionStartTime(duration, outroStartS, transitionDurationS)

    if (currentTime >= transitionStartTime) {
      this.transitionScheduled = true
      this.scheduleTransition()
    }
  }

  private scheduleTransition(): void {
    const nextIndex = this.currentIndex + 1
    if (nextIndex >= this.tracks.length) return

    const nextTrack = this.tracks[nextIndex]
    this.executeTransition(nextTrack.transitionType).catch((error) => {
      this.onError?.(error as Error)
    })
  }

  private async executeTransition(type: TransitionType): Promise<void> {
    if (this.isTransitioning) return

    this.isTransitioning = true
    const fromIndex = this.currentIndex
    const toIndex = fromIndex + 1

    if (toIndex >= this.tracks.length) {
      this.isTransitioning = false
      return
    }

    const fromDeck = this.getActiveDeck()
    const toDeck = this.getInactiveDeck()
    const nextTrack = this.tracks[toIndex]
    const currentTrack = this.tracks[fromIndex]

    // Garante que a próxima faixa está carregada
    if (!toDeck.getBuffer()) {
      try {
        await this.loadTrack(toDeck, nextTrack)
      } catch (error) {
        this.isTransitioning = false
        this.onError?.(new Error(`Falha ao carregar "${nextTrack.title}": ${(error as Error).message}`))
        this.currentIndex = toIndex
        this.transitionScheduled = false
        this.preloadScheduled = false
        await this.trySkipToNextValid()
        return
      }
    }

    this.onTransitionStart?.(fromIndex, toIndex)

    const bpm = currentTrack.analysis?.bpm ?? 120
    const config = {
      durationBeats: 16,
      bpm,
    }

    try {
      switch (type) {
        case 'crossfade':
          await crossfadeTransition(fromDeck, toDeck, this.crossfader, config)
          break
        case 'eq_swap':
          await eqSwapTransition(fromDeck, toDeck, this.crossfader, config)
          break
        case 'filter_sweep':
          await filterSweepTransition(fromDeck, toDeck, this.crossfader, config)
          break
        case 'rewind':
          await rewindTransition(fromDeck, toDeck, this.crossfader, config)
          break
        case 'buildup_drop':
          await buildupDropTransition(fromDeck, toDeck, this.crossfader, config)
          break
        case 'echo_out':
          await echoOutTransition(fromDeck, toDeck, this.crossfader, config)
          break
        case 'brake':
          await brakeTransition(fromDeck, toDeck, this.crossfader, config)
          break
      }
    } catch (error) {
      this.onError?.(error as Error)
    }

    // Alterna o deck ativo
    this.activeDeck = this.activeDeck === 'A' ? 'B' : 'A'
    this.currentIndex = toIndex
    this.transitionScheduled = false
    this.preloadScheduled = false
    this.isTransitioning = false

    this.onTrackChange?.(this.currentIndex, this.tracks[this.currentIndex])

    // Se era a última faixa, agenda notificação de fim do set
    if (this.currentIndex >= this.tracks.length - 1) {
      const deck = this.getActiveDeck()
      const remaining = deck.getDuration() - deck.getCurrentTime()
      if (remaining > 0) {
        setTimeout(() => {
          if (!this.isTransitioning) {
            this._isPlaying = false
            this.stopTick()
            this.onSetEnd?.()
          }
        }, remaining * 1000)
      }
    }
  }

  /**
   * Quando uma faixa falha ao carregar, tenta avançar para a próxima válida.
   */
  private async trySkipToNextValid(): Promise<void> {
    while (this.currentIndex < this.tracks.length) {
      const track = this.tracks[this.currentIndex]
      const deck = this.getActiveDeck()

      try {
        await this.loadTrack(deck, track)
        deck.play()
        this.onTrackChange?.(this.currentIndex, track)
        return
      } catch {
        this.onError?.(new Error(`Pulando "${track.title}" — falha ao carregar`))
        this.currentIndex++
      }
    }

    this._isPlaying = false
    this.stopTick()
    this.onSetEnd?.()
  }
}
