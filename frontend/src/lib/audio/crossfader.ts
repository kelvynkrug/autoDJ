/**
 * Crossfader controla o balanço entre Deck A e Deck B.
 * Usa equal-power crossfade: gain_A = cos(position * π/2), gain_B = sin(position * π/2)
 *
 * position = 0 → 100% Deck A
 * position = 1 → 100% Deck B
 */
export class CrossfaderNode {
  private context: AudioContext
  private gainA: GainNode
  private gainB: GainNode
  private output: GainNode
  private _position: number = 0

  constructor(context: AudioContext) {
    this.context = context
    this.gainA = context.createGain()
    this.gainB = context.createGain()
    this.output = context.createGain()

    this.gainA.connect(this.output)
    this.gainB.connect(this.output)

    // Posição inicial: full Deck A
    this.applyPosition(0)
  }

  /** Nó de entrada para o Deck A. */
  getInputA(): GainNode {
    return this.gainA
  }

  /** Nó de entrada para o Deck B. */
  getInputB(): GainNode {
    return this.gainB
  }

  /** Nó de saída mesclado (conectar ao masterGain). */
  getOutput(): GainNode {
    return this.output
  }

  /**
   * Define a posição do crossfader imediatamente.
   * @param value 0 = full A, 1 = full B
   */
  setPosition(value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    this._position = clamped
    this.applyPosition(clamped)
  }

  /** Retorna a posição atual do crossfader (0-1). */
  getPosition(): number {
    return this._position
  }

  /**
   * Fade suave do crossfader até uma posição alvo.
   * Usa linearRampToValueAtTime para evitar cliques.
   *
   * @param position Posição alvo (0-1)
   * @param durationSeconds Duração do fade
   */
  fadeTo(position: number, durationSeconds: number): void {
    const target = Math.max(0, Math.min(1, position))
    const now = this.context.currentTime

    const gainAValue = Math.cos(target * Math.PI / 2)
    const gainBValue = Math.sin(target * Math.PI / 2)

    this.gainA.gain.cancelScheduledValues(now)
    this.gainA.gain.setValueAtTime(this.gainA.gain.value, now)
    this.gainA.gain.linearRampToValueAtTime(gainAValue, now + durationSeconds)

    this.gainB.gain.cancelScheduledValues(now)
    this.gainB.gain.setValueAtTime(this.gainB.gain.value, now)
    this.gainB.gain.linearRampToValueAtTime(gainBValue, now + durationSeconds)

    this._position = target
  }

  /** Conecta a saída do crossfader a um destino. */
  connect(destination: AudioNode): void {
    this.output.connect(destination)
  }

  /** Desconecta a saída do crossfader. */
  disconnect(): void {
    this.output.disconnect()
  }

  private applyPosition(position: number): void {
    this.gainA.gain.value = Math.cos(position * Math.PI / 2)
    this.gainB.gain.value = Math.sin(position * Math.PI / 2)
  }
}
