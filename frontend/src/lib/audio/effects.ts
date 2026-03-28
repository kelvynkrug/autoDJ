import type { Deck } from './deck'
import { beatsToSeconds } from './utils'

/**
 * Efeitos sonoros de DJ sintetizados com Web Audio API pura.
 * Sem samples externos — tudo gerado via OscillatorNode, AudioBuffer e filtros.
 */
export class DJEffects {
  private context: AudioContext

  constructor(context: AudioContext) {
    this.context = context
  }

  /**
   * Rewind/Backspin: reduz playback rate rapidamente com highpass crescente.
   * Simula o som de rebobinar um disco de vinil.
   */
  applyRewind(source: AudioBufferSourceNode, duration: number): void {
    const now = this.context.currentTime

    // Desacelera até quase parar (efeito rebobinar)
    source.playbackRate.cancelScheduledValues(now)
    source.playbackRate.setValueAtTime(source.playbackRate.value, now)
    source.playbackRate.exponentialRampToValueAtTime(0.1, now + duration)

    // Pausa no final do efeito
    setTimeout(() => {
      source.playbackRate.cancelScheduledValues(this.context.currentTime)
      source.playbackRate.setValueAtTime(0.001, this.context.currentTime)
    }, duration * 1000)

    // Retoma após 2 segundos de pausa
    setTimeout(() => {
      source.playbackRate.cancelScheduledValues(this.context.currentTime)
      source.playbackRate.setValueAtTime(1.0, this.context.currentTime)
    }, (duration + 2) * 1000)
  }

  /**
   * Build-up + Drop: highpass crescente que corta graves, seguido de restauração abrupta.
   * Cria a sensação de tensão → liberação típica de EDM.
   *
   * @param deck Deck onde aplicar o efeito
   * @param durationBeats Duração do build-up em beats
   * @param bpm BPM da faixa
   */
  applyBuildUp(deck: Deck, durationBeats: number, bpm: number): void {
    const durationS = beatsToSeconds(durationBeats, bpm)

    // Fase build-up: corta graves e médios gradualmente
    deck.fadeEQTo('low', -40, durationS)
    deck.fadeEQTo('mid', -20, durationS * 0.8)

    // Fase drop: restaura tudo de uma vez após o build-up
    setTimeout(() => {
      deck.setLowGain(0)
      deck.setMidGain(0)
    }, durationS * 1000)
  }

  /**
   * Echo Out: aplica delay com feedback decrescente.
   * Cria eco que vai sumindo na faixa que sai.
   *
   * @param deck Deck onde aplicar o eco
   * @param durationBeats Duração total do echo out em beats
   * @param bpm BPM da faixa
   */
  applyEchoOut(deck: Deck, durationBeats: number, bpm: number): void {
    const beatDuration = beatsToSeconds(1, bpm)
    const totalDuration = beatsToSeconds(durationBeats, bpm)
    const now = this.context.currentTime

    const delay = this.context.createDelay(beatDuration)
    delay.delayTime.value = beatDuration

    const feedback = this.context.createGain()
    feedback.gain.setValueAtTime(0.6, now)
    feedback.gain.linearRampToValueAtTime(0, now + totalDuration)

    const output = deck.getOutput()

    // Insere delay loop: output -> delay -> feedback -> delay (loop)
    // e delay -> output (mix do eco com sinal original)
    output.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(output)

    // Cleanup após o efeito terminar
    setTimeout(() => {
      try {
        output.disconnect(delay)
        delay.disconnect()
        feedback.disconnect()
      } catch {
        // nós podem já ter sido desconectados
      }
    }, totalDuration * 1000 + 500)
  }

  /**
   * Vinyl Brake/Stop: desacelera o playback rate linearmente até parar.
   * Simula disco de vinil freando.
   */
  applyBrake(source: AudioBufferSourceNode, duration: number): void {
    const now = this.context.currentTime

    // Freia até parar (nao volta)
    source.playbackRate.cancelScheduledValues(now)
    source.playbackRate.setValueAtTime(source.playbackRate.value, now)
    source.playbackRate.linearRampToValueAtTime(0.001, now + duration)
  }

  /**
   * Sirene/Air Horn sintetizada: oscilador que sobe e desce em frequência.
   * Tom vai de 800Hz a 1200Hz e volta, 3 vezes.
   *
   * @param destination Nó de destino (ex: masterGain)
   * @param duration Duração total em segundos (padrão: 1.5)
   */
  playSiren(destination: AudioNode, duration: number = 1.5): void {
    const ctx = this.context
    const now = ctx.currentTime

    const oscillator = ctx.createOscillator()
    oscillator.type = 'sawtooth'

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.6, now)

    // 3 ciclos de 800Hz -> 1200Hz -> 800Hz
    const cycleTime = duration / 3
    for (let i = 0; i < 3; i++) {
      const cycleStart = now + i * cycleTime
      oscillator.frequency.setValueAtTime(800, cycleStart)
      oscillator.frequency.linearRampToValueAtTime(1200, cycleStart + cycleTime / 2)
      oscillator.frequency.linearRampToValueAtTime(800, cycleStart + cycleTime)
    }

    // Fade out no final para não cortar seco
    gain.gain.setValueAtTime(0.6, now + duration - 0.1)
    gain.gain.linearRampToValueAtTime(0, now + duration)

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.start(now)
    oscillator.stop(now + duration)

    setTimeout(() => {
      oscillator.disconnect()
      gain.disconnect()
    }, (duration + 0.5) * 1000)
  }

  /**
   * Riser (White Noise Build): ruído branco que cresce em volume antes do drop.
   * Usa bandpass filter para focar o ruído em frequências médio-altas.
   *
   * @param destination Nó de destino (ex: masterGain)
   * @param durationSeconds Duração do riser em segundos
   */
  playRiser(destination: AudioNode, durationSeconds: number): void {
    const now = this.context.currentTime
    const noiseBuffer = this.createWhiteNoise(durationSeconds)

    const source = this.context.createBufferSource()
    source.buffer = noiseBuffer

    const bandpass = this.context.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.setValueAtTime(2000, now)
    bandpass.frequency.linearRampToValueAtTime(8000, now + durationSeconds)
    bandpass.Q.value = 0.5

    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.8, now + durationSeconds)

    source.connect(bandpass)
    bandpass.connect(gain)
    gain.connect(this.context.destination)

    source.start(now)
    source.stop(now + durationSeconds)

    setTimeout(() => {
      source.disconnect()
      bandpass.disconnect()
      gain.disconnect()
    }, (durationSeconds + 0.5) * 1000)
  }

  /**
   * Gera um AudioBuffer de ruído branco (valores aleatórios entre -1 e 1).
   */
  private createWhiteNoise(duration: number): AudioBuffer {
    const sampleRate = this.context.sampleRate
    const length = Math.ceil(sampleRate * duration)
    const buffer = this.context.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }

    return buffer
  }
}
