import logging

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import BatchDownloadRequest, BatchDownloadResponse
from app.services.background import process_track_download

router = APIRouter(prefix="/download", tags=["download"])
logger = logging.getLogger(__name__)


@router.post("/batch", response_model=BatchDownloadResponse)
async def batch_download(
    request: BatchDownloadRequest,
    background_tasks: BackgroundTasks,
) -> BatchDownloadResponse:
    """Agenda download de multiplas tracks em background."""
    track_ids: list[str] = []

    for track in request.tracks:
        query = track.query
        if not query and track.artist and track.title:
            query = f"{track.artist} - {track.title}"

        background_tasks.add_task(
            process_track_download,
            track_id=track.track_id,
            query=query,
            youtube_id=track.youtube_id,
            artist=track.artist,
            title=track.title,
        )
        track_ids.append(track.track_id)

    logger.info("Agendados %d downloads em background", len(track_ids))
    return BatchDownloadResponse(track_ids=track_ids)
