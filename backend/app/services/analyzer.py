"""
Analise de audio com interface abstrata.
Usa Essentia se disponivel, senao librosa como fallback.
"""

import abc
import logging

import numpy as np

from app.models.schemas import TrackAnalysis
from app.utils.camelot import key_to_camelot

logger = logging.getLogger(__name__)


class AudioAnalyzer(abc.ABC):
    @abc.abstractmethod
    def analyze(self, file_path: str) -> TrackAnalysis:
        ...


class LibrosaAnalyzer(AudioAnalyzer):
    """Analyzer baseado em librosa (fallback)."""

    def analyze(self, file_path: str) -> TrackAnalysis:
        import librosa

        y, sr = librosa.load(file_path, sr=22050, mono=True)
        duration = librosa.get_duration(y=y, sr=sr)

        # BPM
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(np.atleast_1d(tempo)[0])

        # Confianca do BPM baseada na regularidade dos beats
        if len(beat_frames) > 2:
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)
            intervals = np.diff(beat_times)
            bpm_confidence = float(1.0 - min(np.std(intervals) / (np.mean(intervals) + 1e-6), 1.0))
        else:
            bpm_confidence = 0.0

        # Key detection via chroma
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_avg = np.mean(chroma, axis=1)

        pitch_classes = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"]
        key_idx = int(np.argmax(chroma_avg))
        key_name = pitch_classes[key_idx]

        # Estimar modo (major/minor) pelo perfil de chroma
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52,
                                  5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54,
                                  4.75, 3.98, 2.69, 3.34, 3.17])

        rotated_chroma = np.roll(chroma_avg, -key_idx)
        major_corr = float(np.corrcoef(rotated_chroma, major_profile)[0, 1])
        minor_corr = float(np.corrcoef(rotated_chroma, minor_profile)[0, 1])

        mode = "major" if major_corr >= minor_corr else "minor"
        key_confidence = float(max(major_corr, minor_corr))

        camelot = key_to_camelot(key_name, mode) or "1A"

        # Energy (RMS normalizada)
        rms = librosa.feature.rms(y=y)[0]
        energy = float(np.clip(np.mean(rms) / 0.1, 0, 1))

        # Danceability (combinacao de onset strength e regularidade ritmica)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onset_mean = float(np.mean(onset_env))
        danceability = float(np.clip(onset_mean / 20.0, 0, 1))
        if bpm_confidence > 0.5:
            danceability = min(1.0, danceability * 1.2)

        # Loudness
        power = np.mean(y**2)
        loudness_db = float(10 * np.log10(power + 1e-10))

        # Intro/Outro detection via onset envelope
        intro_end = _detect_intro_end(onset_env, sr)
        outro_start = _detect_outro_start(onset_env, sr, duration)

        return TrackAnalysis(
            bpm=round(bpm, 1),
            bpm_confidence=round(bpm_confidence, 3),
            key=f"{key_name} {mode}",
            key_confidence=round(max(0, min(key_confidence, 1)), 3),
            camelot=camelot,
            energy=round(energy, 3),
            danceability=round(danceability, 3),
            loudness_db=round(loudness_db, 1),
            intro_end_seconds=round(intro_end, 1),
            outro_start_seconds=round(outro_start, 1),
        )


class EssentiaAnalyzer(AudioAnalyzer):
    """Analyzer baseado em Essentia (preferido, mais preciso)."""

    def analyze(self, file_path: str) -> TrackAnalysis:
        import essentia.standard as es

        loader = es.MonoLoader(filename=file_path, sampleRate=44100)
        audio = loader()

        # BPM
        rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
        bpm, beats, beats_confidence, _, _ = rhythm_extractor(audio)

        # Key
        key_extractor = es.KeyExtractor()
        key_name, mode, key_confidence = key_extractor(audio)

        camelot = key_to_camelot(key_name, mode) or "1A"

        # Energy
        energy_extractor = es.Energy()
        total_energy = energy_extractor(audio)
        energy = float(np.clip(total_energy / (len(audio) * 0.01), 0, 1))

        # Danceability
        dance_extractor = es.Danceability()
        danceability, _ = dance_extractor(audio)

        # Loudness
        loudness_extractor = es.Loudness()
        loudness = loudness_extractor(audio)
        loudness_db = float(10 * np.log10(loudness + 1e-10))

        # Intro/Outro (simplificado)
        sr = 44100
        onset_detector = es.OnsetRate()
        _, onset_times = onset_detector(audio)
        duration = len(audio) / sr

        intro_end = float(onset_times[0]) if len(onset_times) > 0 else 0.0
        outro_start = float(onset_times[-1]) if len(onset_times) > 0 else duration

        return TrackAnalysis(
            bpm=round(float(bpm), 1),
            bpm_confidence=round(float(np.mean(beats_confidence)), 3),
            key=f"{key_name} {mode}",
            key_confidence=round(float(key_confidence), 3),
            camelot=camelot,
            energy=round(energy, 3),
            danceability=round(float(danceability), 3),
            loudness_db=round(loudness_db, 1),
            intro_end_seconds=round(intro_end, 1),
            outro_start_seconds=round(outro_start, 1),
        )


def _detect_intro_end(onset_env: np.ndarray, sr: int, hop_length: int = 512) -> float:
    """Detecta fim da intro baseado em quando a onset strength fica consistente."""
    if len(onset_env) < 10:
        return 0.0

    threshold = np.mean(onset_env) * 0.5
    window = 10

    for i in range(window, len(onset_env)):
        segment = onset_env[i - window : i]
        if np.mean(segment) >= threshold:
            return float(i * hop_length / sr)

    return 0.0


def _detect_outro_start(
    onset_env: np.ndarray, sr: int, duration: float, hop_length: int = 512
) -> float:
    """Detecta inicio do outro baseado em queda da onset strength."""
    if len(onset_env) < 10:
        return duration

    threshold = np.mean(onset_env) * 0.5
    window = 10

    for i in range(len(onset_env) - 1, window, -1):
        segment = onset_env[i - window : i]
        if np.mean(segment) >= threshold:
            return float(i * hop_length / sr)

    return duration


def get_analyzer() -> AudioAnalyzer:
    """Retorna o melhor analyzer disponivel."""
    try:
        import essentia  # noqa: F401

        logger.info("Usando Essentia para analise de audio")
        return EssentiaAnalyzer()
    except ImportError:
        logger.info("Essentia nao disponivel, usando librosa como fallback")
        return LibrosaAnalyzer()


def analyze_track(file_path: str) -> TrackAnalysis:
    """Analisa arquivo de audio. Retorna metricas musicais."""
    analyzer = get_analyzer()
    return analyzer.analyze(file_path)
