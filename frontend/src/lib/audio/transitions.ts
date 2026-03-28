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

/**
 * Rewind Transition: backspin no deck A enquanto deck B entra limpo.
 *
 * O deck que sai tem seu playback rate reduzido exponencialmente (efeito rebobinar),
 * enquanto o crossfader move suavemente para o deck que entra.
 */
export async function rewindTransition(
  fromDeck: Deck,
  toDeck: Deck,
  crossfader: CrossfaderNode,
  config: TransitionConfig,
): Promise<void> {
  const durationS = beatsToSeconds(config.durationBeats, config.bpm)
  const currentPos = crossfader.getPosition()
  const targetPos = currentPos < 0.5 ? 1 : 0
  const effects = new DJEffects(fromDeck['context'])

  toDeck.play()

  // Aplica rewind no source do fromDeck
  const fromSource = fromDeck['source']
  if (fromSource) {
    effects.applyRewind(fromSource, durationS * 0.6)
  }

  // Fade out do from e crossfader move
  fromDeck.fadeVolumeTo(0, durationS * 0.6)
  crossfader.fadeTo(targetPos, durationS)

  await wait(durationS * 1000)

  fromDeck.stop()
  fromDeck.setVolume(1)
}

/**
 * Build-up + Drop: cria tensão cortando graves do deck A (highpass crescente),
 * seguido de uma liberação explosiva quando deck B entra com graves plenos.
 *
 * Inclui um riser de ruído branco para aumentar a energia antes do drop.
 */
export async function buildupDropTransition(
  fromDeck: Deck,
  toDeck: Deck,
  crossfader: CrossfaderNode,
  config: TransitionConfig,
): Promise<void> {
  const durationS = beatsToSeconds(config.durationBeats, config.bpm)
  const currentPos = crossfader.getPosition()
  const targetPos = currentPos < 0.5 ? 1 : 0
  const context = fromDeck['context'] as AudioContext
  const effects = new DJEffects(context)

  // Fase build-up: corta graves do fromDeck gradualmente
  fromDeck.fadeEQTo('low', -40, durationS * 0.75)
  fromDeck.fadeEQTo('mid', -20, durationS * 0.6)

  // Riser de ruído branco acompanha o build-up
  const masterOutput = crossfader['output'] as GainNode
  effects.playRiser(masterOutput, durationS * 0.75)

  await wait(durationS * 0.75 * 1000)

  // Drop: toDeck entra com tudo, fromDeck sai
  toDeck.play()
  crossfader.fadeTo(targetPos, durationS * 0.1)
  fromDeck.fadeVolumeTo(0, durationS * 0.25)

  await wait(durationS * 0.25 * 1000)

  // Cleanup
  fromDeck.stop()
  fromDeck.setVolume(1)
  fromDeck.setLowGain(0)
  fromDeck.setMidGain(0)
}

/**
 * Echo Out: deck A ganha eco/delay com feedback decrescente enquanto
 * deck B entra suavemente por baixo.
 *
 * O eco vai sumindo naturalmente, criando espaço para a próxima faixa.
 */
export async function echoOutTransition(
  fromDeck: Deck,
  toDeck: Deck,
  crossfader: CrossfaderNode,
  config: TransitionConfig,
): Promise<void> {
  const durationS = beatsToSeconds(config.durationBeats, config.bpm)
  const currentPos = crossfader.getPosition()
  const targetPos = currentPos < 0.5 ? 1 : 0
  const context = fromDeck['context'] as AudioContext
  const effects = new DJEffects(context)

  // Aplica echo no deck que sai
  effects.applyEchoOut(fromDeck, config.durationBeats, config.bpm)

  // Fade out do fromDeck
  fromDeck.fadeVolumeTo(0, durationS)

  // toDeck entra com fade in suave
  toDeck.play()
  crossfader.fadeTo(targetPos, durationS * 0.7)

  await wait(durationS * 1000)

  fromDeck.stop()
  fromDeck.setVolume(1)
}

/**
 * Brake Transition: vinyl stop no deck A (desacelera o disco) enquanto
 * deck B entra por cima.
 *
 * Simula o DJ freando o disco de vinil manualmente.
 */
export async function brakeTransition(
  fromDeck: Deck,
  toDeck: Deck,
  crossfader: CrossfaderNode,
  config: TransitionConfig,
): Promise<void> {
  const durationS = beatsToSeconds(config.durationBeats, config.bpm)
  const brakeDuration = Math.min(durationS * 0.4, 2)
  const currentPos = crossfader.getPosition()
  const targetPos = currentPos < 0.5 ? 1 : 0
  const effects = new DJEffects(fromDeck['context'])

  toDeck.play()

  // Aplica brake no source do fromDeck
  const fromSource = fromDeck['source']
  if (fromSource) {
    effects.applyBrake(fromSource, brakeDuration)
  }

  fromDeck.fadeVolumeTo(0, brakeDuration)
  crossfader.fadeTo(targetPos, durationS * 0.5)

  await wait(durationS * 0.5 * 1000)

  fromDeck.stop()
  fromDeck.setVolume(1)
}
