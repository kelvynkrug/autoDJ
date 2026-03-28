import { dbToLinear } from './utils'

/**
 * Deck representa um canal de reprodução com source, gain e EQ de 3 bandas.
 * Grafo: AudioBufferSource -> GainNode -> LowShelf -> MidPeak -> HighShelf -> output
 */
export class Deck {
  private context: AudioContext
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null
  private gainNode: GainNode
  private lowEQ: BiquadFilterNode
  private midEQ: BiquadFilterNode
  private highEQ: BiquadFilterNode
  private output: GainNode

  private startTime: number = 0
  private pauseOffset: number = 0
  private _isPlaying: boolean = false

  constructor(context: AudioContext) {
    this.context = context

    this.gainNode = context.createGain()

    // Low shelf: 300Hz
    this.lowEQ = context.createBiquadFilter()
    this.lowEQ.type = 'lowshelf'
    this.lowEQ.frequency.value = 300
    this.lowEQ.gain.value = 0

    // Mid peaking: 1kHz, Q=0.7
    this.midEQ = context.createBiquadFilter()
    this.midEQ.type = 'peaking'
    this.midEQ.frequency.value = 1000
    this.midEQ.Q.value = 0.7
    this.midEQ.gain.value = 0

    // High shelf: 3kHz
    this.highEQ = context.createBiquadFilter()
    this.highEQ.type = 'highshelf'
    this.highEQ.frequency.value = 3000
    this.highEQ.gain.value = 0

    this.output = context.createGain()

    // Cadeia: gain -> low -> mid -> high -> output
    this.gainNode.connect(this.lowEQ)
    this.lowEQ.connect(this.midEQ)
    this.midEQ.connect(this.highEQ)
    this.highEQ.connect(this.output)
  }

  /** Conecta a saída do deck a um nó destino (ex: crossfader input). */
  connect(destination: AudioNode): void {
    this.output.connect(destination)
  }

  /** Desconecta a saída do deck de todos os destinos. */
  disconnect(): void {
    this.output.disconnect()
  }

  /**
   * Carrega áudio a partir de uma URL (pre-signed ou pública).
   * Faz fetch do arquivo e decodifica via Web Audio API.
   */
  async loadFromUrl(url: string): Promise<void> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Falha ao carregar áudio: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    this.buffer = await this.context.decodeAudioData(arrayBuffer)
    this.pauseOffset = 0
  }

  /**
   * Inicia a reprodução a partir de um offset (em segundos).
   * Cria um novo AudioBufferSourceNode a cada play (padrão Web Audio API).
   */
  play(offset?: number): void {
    if (!this.buffer) return

    this.stop()

    this.source = this.context.createBufferSource()
    this.source.buffer = this.buffer
    this.source.connect(this.gainNode)

    const resumeAt = offset ?? this.pauseOffset
    this.startTime = this.context.currentTime - resumeAt
    this.source.start(0, resumeAt)
    this._isPlaying = true

    this.source.onended = () => {
      if (this._isPlaying) {
        this._isPlaying = false
        this.pauseOffset = 0
      }
    }
  }

  /** Pausa a reprodução, salvando o offset atual. */
  pause(): void {
    if (!this._isPlaying || !this.source) return

    this.pauseOffset = this.getCurrentTime()
    this.source.onended = null
    this.source.stop()
    this.source.disconnect()
    this.source = null
    this._isPlaying = false
  }

  /** Para a reprodução e reseta o offset para 0. */
  stop(): void {
    if (this.source) {
      this.source.onended = null
      try {
        this.source.stop()
      } catch {
        // source pode já ter sido parado
      }
      this.source.disconnect()
      this.source = null
    }
    this._isPlaying = false
    this.pauseOffset = 0
  }

  /** Retorna a posição atual de reprodução em segundos. */
  getCurrentTime(): number {
    if (this._isPlaying) {
      const elapsed = this.context.currentTime - this.startTime
      const duration = this.getDuration()
      return duration > 0 ? Math.min(elapsed, duration) : elapsed
    }
    return this.pauseOffset
  }

  /** Retorna a duração total do buffer carregado, em segundos. */
  getDuration(): number {
    return this.buffer?.duration ?? 0
  }

  /** Retorna o AudioBuffer carregado, ou null. */
  getBuffer(): AudioBuffer | null {
    return this.buffer
  }

  /** Limpa o buffer carregado, forçando reload no próximo play. */
  clearBuffer(): void {
    this.buffer = null
    this.pauseOffset = 0
  }

  /** Indica se o deck está reproduzindo. */
  isActive(): boolean {
    return this._isPlaying
  }

  /**
   * Define o ganho do EQ de graves (low shelf 300Hz).
   * @param db Valor em dB (-40 a +6)
   */
  setLowGain(db: number): void {
    this.lowEQ.gain.value = clampEQ(db)
  }

  /**
   * Define o ganho do EQ de médios (peaking 1kHz).
   * @param db Valor em dB (-40 a +6)
   */
  setMidGain(db: number): void {
    this.midEQ.gain.value = clampEQ(db)
  }

  /**
   * Define o ganho do EQ de agudos (high shelf 3kHz).
   * @param db Valor em dB (-40 a +6)
   */
  setHighGain(db: number): void {
    this.highEQ.gain.value = clampEQ(db)
  }

  /**
   * Define o volume do deck.
   * @param value Ganho linear de 0 a 1
   */
  setVolume(value: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, value))
  }

  /** Retorna o volume atual do deck (0-1). */
  getVolume(): number {
    return this.gainNode.gain.value
  }

  /**
   * Fade suave do volume até um valor alvo.
   * Usa linearRampToValueAtTime para transição sem clicks.
   */
  fadeVolumeTo(value: number, durationSeconds: number): void {
    const target = Math.max(0, Math.min(1, value))
    const now = this.context.currentTime
    this.gainNode.gain.cancelScheduledValues(now)
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now)
    this.gainNode.gain.linearRampToValueAtTime(target, now + durationSeconds)
  }

  /**
   * Fade suave de uma banda do EQ até um valor em dB.
   * @param band Banda a ser ajustada
   * @param db Valor alvo em dB (-40 a +6)
   * @param durationSeconds Duração do fade
   */
  fadeEQTo(band: 'low' | 'mid' | 'high', db: number, durationSeconds: number): void {
    const target = clampEQ(db)
    const filter = band === 'low' ? this.lowEQ : band === 'mid' ? this.midEQ : this.highEQ
    const now = this.context.currentTime
    filter.gain.cancelScheduledValues(now)
    filter.gain.setValueAtTime(filter.gain.value, now)
    filter.gain.linearRampToValueAtTime(target, now + durationSeconds)
  }

  /**
   * Retorna o nó de saída do EQ de uma banda específica.
   * Usado pelo filter sweep para conectar filtros externos.
   */
  getEQNode(band: 'low' | 'mid' | 'high'): BiquadFilterNode {
    return band === 'low' ? this.lowEQ : band === 'mid' ? this.midEQ : this.highEQ
  }

  /** Retorna o GainNode de saída para conexão externa. */
  getOutput(): GainNode {
    return this.output
  }

  /** Retorna o AudioBufferSourceNode ativo, ou null se não estiver tocando. */
  getSource(): AudioBufferSourceNode | null {
    return this.source
  }
}

function clampEQ(db: number): number {
  return Math.max(-40, Math.min(6, db))
}
