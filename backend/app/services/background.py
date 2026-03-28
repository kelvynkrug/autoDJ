"""Background tasks para download e analise de tracks."""

import logging
import os
from pathlib import Path

from app.config import settings
from app.dependencies import get_supabase_client
from app.services.analyzer import analyze_track
from app.services.downloader import download_by_query, download_by_youtube_id
from app.services.storage import download_audio, upload_audio

logger = logging.getLogger(__name__)


def _update_track_status(track_id: str, status: str, extra: dict | None = None) -> None:
    client = get_supabase_client()
    data = {"status": status}
    if extra:
        data.update(extra)
    try:
        client.table("tracks").update(data).eq("id", track_id).execute()
    except Exception:
        logger.exception("Falha ao atualizar status da track %s para %s", track_id, status)


def _cleanup_file(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        logger.warning("Nao foi possivel remover arquivo temporario: %s", path)


def process_track_download(
    track_id: str,
    query: str | None = None,
    youtube_id: str | None = None,
    artist: str | None = None,
    title: str | None = None,
) -> None:
    """Baixa audio, faz upload pro Supabase Storage, atualiza status no DB."""
    output_dir = str(settings.ensure_temp_dir())

    try:
        _update_track_status(track_id, "downloading")

        if youtube_id:
            result = download_by_youtube_id(youtube_id, output_dir)
        elif artist and title:
            result = download_by_query(artist, title, output_dir)
        elif query:
            parts = query.split(" - ", 1)
            artist_part = parts[0]
            title_part = parts[1] if len(parts) > 1 else parts[0]
            result = download_by_query(artist_part, title_part, output_dir)
        else:
            raise ValueError("Necessario youtube_id, artist+title, ou query")

        storage_path = f"tracks/{track_id}/{result.youtube_id}.{result.format}"
        upload_audio(result.path, storage_path)

        _update_track_status(
            track_id,
            "analyzing",
            {
                "youtube_id": result.youtube_id,
                "audio_storage_path": storage_path,
                "file_size_bytes": result.size_bytes,
            },
        )

        _cleanup_file(result.path)
        logger.info("Download concluido para track %s (yt:%s)", track_id, result.youtube_id)

        # Dispara analise automaticamente apos download
        process_track_analysis(track_id)

    except Exception as exc:
        _update_track_status(track_id, "error", {"error_message": str(exc)})
        logger.exception("Erro no download da track %s", track_id)


def process_track_analysis(track_id: str) -> None:
    """Baixa do Storage, analisa, salva track_analysis no DB."""
    output_dir = str(settings.ensure_temp_dir())

    try:
        _update_track_status(track_id, "analyzing")

        client = get_supabase_client()
        track_resp = (
            client.table("tracks")
            .select("audio_storage_path")
            .eq("id", track_id)
            .single()
            .execute()
        )
        storage_path = track_resp.data["audio_storage_path"]

        local_path = os.path.join(output_dir, f"analyze_{track_id}{Path(storage_path).suffix}")
        download_audio(storage_path, local_path)

        analysis = analyze_track(local_path)

        client.table("track_analysis").upsert(
            {
                "track_id": track_id,
                "bpm": analysis.bpm,
                "bpm_confidence": analysis.bpm_confidence,
                "musical_key": analysis.key,
                "key_confidence": analysis.key_confidence,
                "camelot_code": analysis.camelot,
                "energy": analysis.energy,
                "danceability": analysis.danceability,
                "loudness_db": analysis.loudness_db,
                "intro_end_seconds": analysis.intro_end_seconds,
                "outro_start_seconds": analysis.outro_start_seconds,
            }
        ).execute()

        _update_track_status(track_id, "ready")
        _cleanup_file(local_path)

        logger.info(
            "Analise concluida para track %s: BPM=%.1f, Key=%s",
            track_id,
            analysis.bpm,
            analysis.camelot,
        )

    except Exception as exc:
        _update_track_status(track_id, "error", {"error_message": str(exc)})
        logger.exception("Erro na analise da track %s", track_id)
