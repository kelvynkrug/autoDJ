import logging

import yt_dlp

from app.models.schemas import YouTubeSearchResult

logger = logging.getLogger(__name__)


def search_youtube(query: str, max_results: int = 5) -> list[YouTubeSearchResult]:
    """Busca videos no YouTube via yt-dlp (sem API key)."""
    search_query = f"ytsearch{max_results}:{query}"

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
        "force_generic_extractor": False,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(search_query, download=False)

        if not result or "entries" not in result:
            logger.warning("Nenhum resultado para query: %s", query)
            return []

        results: list[YouTubeSearchResult] = []
        for entry in result["entries"]:
            if not entry or not entry.get("id"):
                continue
            results.append(
                YouTubeSearchResult(
                    video_id=entry.get("id", ""),
                    title=entry.get("title", ""),
                    duration_seconds=entry.get("duration"),
                    channel=entry.get("channel", entry.get("uploader", "")),
                )
            )

        logger.info("Busca '%s': %d resultados encontrados", query, len(results))
        return results

    except Exception:
        logger.exception("Erro ao buscar no YouTube: query=%s", query)
        return []
