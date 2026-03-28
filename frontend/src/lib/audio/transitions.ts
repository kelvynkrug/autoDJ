import type { Deck } from './deck'
import type { CrossfaderNode } from './crossfader'
import { DJEffects } from './effects'
import { beatsToSeconds } from './utils'

export interface TransitionConfig {
  /** Duração em beats (4-32). */
  durationBeats: number
  /** BPM da faixa ativa. */
  bpm: number
}

/**
 * Retorna uma Promise que resolve após `ms` milissegundos.
 * Usada para aguardar transições baseadas em tempo real.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Crossfade simples com equal-power.
 *
 * Move o crossfader de uma posição para a outra ao longo da duração.
 * Os ganhos A/B seguem cos/sin para manter volume constante.
 *
 * @param fromDeck Deck que está saindo (volume fade out)
 * @param toDeck Deck que está entrando (volume fade in)
 * @param crossfader Crossfader entre os dois decks
 * @param config Duração em beats e BPM
 */
export async function crossfadeTransition(
  fromDeck: Deck,
  toDeck: Deck,
  crossfader: CrossfaderNode,
  config: TransitionConfig,
): Promise<void> {
  const durationS = beatsToSeconds(config.durationBeats, config.bpm)
  const currentPos = crossfader.getPosition()

  // Se crossfader em A (0), vai pra B (1) e vice-versa
  const targetPos = currentPos < 0.5 ? 1 : 0

  // Inicia a próxima faixa
  toDeck.play()

  // Fade do crossfader
  crossfader.fadeTo(targetPos, durationS)

  await wait(durationS * 1000)

  // Para o deck que saiu
  fromDeck.stop()
}

/**
 * EQ Swap: troca os graves entre os decks no meio da transição.
 *
 * Fase 1 (metade da duração): fade out dos graves do deck A
 * Ponto central: troca — graves do A em -40dB, graves do B em 0dB
 * Fase 2 (metade restante): crossfade completo
 *
 * Técnica clássica de DJs para transições limpas em bass music.
 */
export async function eqSwapTransition(
  fromDeck: Deck,
  toDeck: Deck,
  crossfader: CrossfaderNode,
  config: TransitionConfig,
): Promise<void> {
  const durationS = beatsToSeconds(config.durationBeats, config.bpm)
  const halfDuration = durationS / 2
  const currentPos = crossfader.getPosition()
  const targetPos = currentPos < 0.5 ? 1 : 0

  // Prepara: graves do toDeck em -40dB, volume audível
  toDeck.setLowGain(-40)
  toDeck.play()

  // Fase 1: crossfader vai até o meio, graves do fromDeck fadeiam pra -40dB
  const midPos = currentPos + (targetPos - currentPos) * 0.5
  crossfader.fadeTo(midPos, halfDuration)
  fromDeck.fadeEQTo('low', -40, halfDuration)
  toDeck.fadeEQTo('low', 0, halfDuration)

  await wait(halfDuration * 1000)

  // Fase 2: crossfader completa o movimento, fromDeck fade out total
  crossfader.fadeTo(targetPos, halfDuration)
  fromDeck.fadeVolumeTo(0, halfDuration)

  await wait(halfDuration * 1000)

  // Cleanup
  fromDeck.stop()
  fromDeck.setVolume(1)
  fromDeck.setLowGain(0)
}

/**
 * Filter Sweep: high-pass crescente no deck que sai, low-pass decrescente no que entra.
 *
 * Cria filtros BiquadFilter temporários:
 * - fromDeck: highpass de 20Hz → 5000Hz (remove graves gradualmente)
 * - toDeck: lowpass de 500Hz → 20000Hz (abre o espectro gradualmente)
 *
 * Usa os AudioParam ramps nativos para suavidade.
 *
 * Nota: como o grafo de áudio do Deck já está conectado, esta transição
 * manipula o EQ de 3 bandas como proxy do filter sweep para simplicidade,
 * evitando reconexão dinâmica de nós.
 */
export async function filterSweepTransition(
  fromDeck: Deck,
  toDeck: Deck,
  crossfader: CrossfaderNode,
  config: TransitionConfig,
): Promise<void> {
  const durationS = beatsToSeconds(config.durationBeats, config.bpm)
  const currentPos = crossfader.getPosition()
  const targetPos = currentPos < 0.5 ? 1 : 0

  // Prepara toDeck: agudos e médios cortados, simula lowpass
  toDeck.setHighGain(-40)
  toDeck.setMidGain(-20)
  toDeck.play()

  // Crossfader vai ao meio rapidamente para ambos ficarem audíveis
  const midPos = currentPos + (targetPos - currentPos) * 0.5
  crossfader.fadeTo(midPos, durationS * 0.2)

  // fromDeck: simula highpass crescente cortando graves e médios
  fromDeck.fadeEQTo('low', -40, durationS)
  fromDeck.fadeEQTo('mid', -20, durationS * 0.8)

  // toDeck: simula lowpass abrindo — restaura agudos e médios
  toDeck.fadeEQTo('high', 0, durationS)
  toDeck.fadeEQTo('mid', 0, durationS * 0.8)

  // Crossfader completa o movimento na segunda metade
  await wait(durationS * 0.3 * 1000)
  crossfader.fadeTo(targetPos, durationS * 0.7)

  await wait(durationS * 0.7 * 1000)

  // Cleanup: reseta EQ de ambos
  fromDeck.stop()
  fromDeck.setLowGain(0)
  fromDeck.setMidGain(0)
  fromDeck.setHighGain(0)
  toDeck.setLowGain(0)
  toDeck.setMidGain(0)
  toDeck.setHighGain(0)
}
