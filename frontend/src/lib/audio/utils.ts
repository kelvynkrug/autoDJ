/**
 * Utilitários de áudio para o AutoDJ engine.
 * Funções puras sem dependências externas.
 */

/**
 * Converte beats para segundos dado um BPM.
 * @param beats Número de beats
 * @param bpm Beats por minuto
 */
export function beatsToSeconds(beats: number, bpm: number): number {
  if (bpm <= 0) return 0
  return (beats / bpm) * 60
}

/**
 * Calcula o instante (em segundos) onde a transição deve começar.
 * Prioriza `outroStartS` quando disponível (vem da análise do Essentia),
 * caso contrário usa a duração da faixa menos a duração da transição.
 *
 * @param trackDurationS Duração total da faixa em segundos
 * @param outroStartS Início do outro detectado (pode ser null)
 * @param transitionDurationS Duração da transição em segundos
 */
export function getTransitionStartTime(
  trackDurationS: number,
  outroStartS: number | null,
  transitionDurationS: number,
): number {
  if (outroStartS !== null && outroStartS > 0) {
    return outroStartS
  }
  return Math.max(0, trackDurationS - transitionDurationS)
}

/**
 * Gera dados de waveform a partir de um AudioBuffer, reduzidos a N amostras.
 * Usa valor absoluto máximo em cada segmento para representar amplitude.
 *
 * @param buffer AudioBuffer decodificado
 * @param samples Número de amostras de saída (ex: 200 para visualização)
 */
export function generateWaveformData(buffer: AudioBuffer, samples: number): Float32Array {
  const channelData = buffer.getChannelData(0)
  const blockSize = Math.floor(channelData.length / samples)
  const waveform = new Float32Array(samples)

  for (let i = 0; i < samples; i++) {
    const start = i * blockSize
    let max = 0
    for (let j = 0; j < blockSize; j++) {
      const abs = Math.abs(channelData[start + j])
      if (abs > max) max = abs
    }
    waveform[i] = max
  }

  return waveform
}

/**
 * Converte decibéis para ganho linear.
 * 0 dB = 1.0, -6 dB ≈ 0.5, -Infinity dB = 0
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

/**
 * Converte ganho linear para decibéis.
 * 1.0 = 0 dB, 0.5 ≈ -6 dB
 */
export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity
  return 20 * Math.log10(linear)
}
