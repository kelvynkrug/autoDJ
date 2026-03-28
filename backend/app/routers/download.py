import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import BatchDownloadRequest, BatchDownloadResponse
from app.services.background import process_track_download

router = APIRouter(prefix="/download", tags=["download"])
logger = logging.getLogger(__name__)

MAX_CONCURRENT = 5
executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT)


async def process_batch_parallel(tracks: list[dict]) -> None:
    """Processa downloads em paralelo com limite de concorrência."""
    loop = asyncio.get_event_loop()
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def download_one(track: dict) -> None:
        async with semaphore:
            await loop.run_in_executor(
                executor,
                lambda: process_track_download(
                    track_id=track["track_id"],
                    query=track.get("query"),
                    youtube_id=track.get("youtube_id"),
                    artist=track.get("artist"),
                    title=track.get("title"),
                ),
            )

    await asyncio.gather(*[download_one(t) for t in tracks])


@router.post("/batch", response_model=BatchDownloadResponse)
async def batch_download(
    request: BatchDownloadRequest,
    background_tasks: BackgroundTasks,
) -> BatchDownloadResponse:
    """Agenda download de multiplas tracks em background (paralelo)."""
    tracks_data: list[dict] = []

    for track in request.tracks:
        query = track.query
        if not query and track.artist and track.title:
            query = f"{track.artist} - {track.title}"

        tracks_data.append({
            "track_id": track.track_id,
            "query": query,
            "youtube_id": track.youtube_id,
            "artist": track.artist,
            "title": track.title,
        })

    background_tasks.add_task(process_batch_parallel, tracks_data)

    logger.info("Agendados %d downloads em paralelo (max %d)", len(tracks_data), MAX_CONCURRENT)
    return BatchDownloadResponse(track_ids=[t["track_id"] for t in tracks_data])
