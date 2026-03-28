import logging

import yt_dlp

from app.models.schemas import YouTubeSearchResult

logger = logging.getLogger(__name__)


def search_youtube(query: str, max_results: int = 5) -> list[YouTubeSearchResult]:
    """Busca videos no YouTube via yt-dlp (sem API key)."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "default_search": f"ytsearch{max_results}",
        "skip_download": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(query, download=False)

        if not result or "entries" not in result:
            return []

        results: list[YouTubeSearchResult] = []
        for entry in result["entries"]:
            if not entry:
                continue
            results.append(
                YouTubeSearchResult(
                    video_id=entry.get("id", ""),
                    title=entry.get("title", ""),
                    duration_seconds=entry.get("duration"),
                    channel=entry.get("channel", entry.get("uploader", "")),
                )
            )

        return results

    except Exception:
        logger.exception("Erro ao buscar no YouTube: query=%s", query)
        return []
