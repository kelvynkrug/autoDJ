import logging
import os
from pathlib import Path

import yt_dlp

from app.config import settings
from app.models.schemas import DownloadResult
from app.services.youtube_search import search_youtube

logger = logging.getLogger(__name__)


def _build_ydl_opts(output_dir: str) -> dict:
    return {
        "format": settings.YTDLP_FORMAT,
        "outtmpl": f"{output_dir}/%(id)s.%(ext)s",
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "m4a",
                "preferredquality": "0",
            }
        ],
    }


def download_by_youtube_id(youtube_id: str, output_dir: str) -> DownloadResult:
    """Baixa audio diretamente pelo ID do YouTube."""
    url = f"https://www.youtube.com/watch?v={youtube_id}"
    return _download(url, youtube_id, output_dir)


def download_by_query(artist: str, title: str, output_dir: str) -> DownloadResult:
    """Busca no YouTube e baixa o melhor resultado."""
    query = f"{artist} {title} audio"
    results = search_youtube(query, max_results=5)

    if not results:
        query_fallback = f"{artist} {title}"
        logger.warning("Sem resultados para '%s', tentando fallback: '%s'", query, query_fallback)
        results = search_youtube(query_fallback, max_results=5)

    if not results:
        raise ValueError(f"Nenhum resultado encontrado para: {artist} - {title}")

    best = results[0]
    logger.info(
        "Melhor resultado para '%s - %s': %s (%s)",
        artist,
        title,
        best.title,
        best.video_id,
    )

    return download_by_youtube_id(best.video_id, output_dir)


def _download(url: str, youtube_id: str, output_dir: str) -> DownloadResult:
    """Executa o download via yt-dlp."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    opts = _build_ydl_opts(output_dir)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

        if info is None:
            raise RuntimeError(f"yt-dlp retornou None para {url}")

        expected_path = Path(output_dir) / f"{youtube_id}.m4a"
        if not expected_path.exists():
            candidates = list(Path(output_dir).glob(f"{youtube_id}.*"))
            if not candidates:
                raise FileNotFoundError(
                    f"Arquivo de audio nao encontrado apos download: {youtube_id}"
                )
            expected_path = candidates[0]

        size = os.path.getsize(expected_path)
        logger.info("Download completo: %s (%d bytes)", expected_path, size)

        return DownloadResult(
            path=str(expected_path),
            format=expected_path.suffix.lstrip("."),
            size_bytes=size,
            youtube_id=youtube_id,
        )

    except Exception:
        logger.exception("Erro no download: youtube_id=%s", youtube_id)
        raise
