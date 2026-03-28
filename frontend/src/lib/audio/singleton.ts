/**
 * Singleton global do AudioEngine que sobrevive a re-renders e navegacao.
 * O AudioContext continua tocando mesmo se o componente React e desmontado.
 */

import { AudioEngine } from './engine'
import { DJEffects } from './effects'

interface AudioSingleton {
  engine: AudioEngine | null
  effects: DJEffects | null
  isInitialized: boolean
}

const audioSingleton: AudioSingleton = {
  engine: null,
  effects: null,
  isInitialized: false,
}

export function getOrCreateEngine(): AudioEngine {
  if (!audioSingleton.engine) {
    audioSingleton.engine = new AudioEngine()
    audioSingleton.isInitialized = false
  }
  return audioSingleton.engine
}

export function getOrCreateEffects(): DJEffects | null {
  if (!audioSingleton.engine) return null
  if (!audioSingleton.effects) {
    audioSingleton.effects = new DJEffects(audioSingleton.engine.getContext())
  }
  return audioSingleton.effects
}

export function getEngine(): AudioEngine | null {
  return audioSingleton.engine
}

export function getEffects(): DJEffects | null {
  return audioSingleton.effects
}

export function isEngineInitialized(): boolean {
  return audioSingleton.isInitialized
}

export function setEngineInitialized(value: boolean): void {
  audioSingleton.isInitialized = value
}

export function destroyEngine(): void {
  if (audioSingleton.engine) {
    audioSingleton.engine.destroy()
    audioSingleton.engine = null
    audioSingleton.effects = null
    audioSingleton.isInitialized = false
  }
}
