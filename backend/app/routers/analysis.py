import logging

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import BatchAnalysisRequest, BatchAnalysisResponse
from app.services.background import process_track_analysis

router = APIRouter(prefix="/analysis", tags=["analysis"])
logger = logging.getLogger(__name__)


@router.post("/batch", response_model=BatchAnalysisResponse)
async def batch_analysis(
    request: BatchAnalysisRequest,
    background_tasks: BackgroundTasks,
) -> BatchAnalysisResponse:
    """Agenda analise de multiplas tracks em background."""
    track_ids: list[str] = []

    for track in request.tracks:
        background_tasks.add_task(
            process_track_analysis,
            track_id=track.track_id,
        )
        track_ids.append(track.track_id)

    logger.info("Agendadas %d analises em background", len(track_ids))
    return BatchAnalysisResponse(track_ids=track_ids)
