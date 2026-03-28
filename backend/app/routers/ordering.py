import logging

from fastapi import APIRouter

from app.models.schemas import OrderingRequest, OrderingResponse
from app.services.ordering import optimize_order

router = APIRouter(prefix="/ordering", tags=["ordering"])
logger = logging.getLogger(__name__)


@router.post("/optimize", response_model=OrderingResponse)
async def optimize_playlist(request: OrderingRequest) -> OrderingResponse:
    """Calcula ordem otimizada para transicoes suaves."""
    ordered = optimize_order(request.tracks, request.start_track_id)

    total_score = sum(t.transition_score for t in ordered) / max(len(ordered), 1)

    logger.info(
        "Ordenacao calculada: %d tracks, score medio=%.3f",
        len(ordered),
        total_score,
    )
    return OrderingResponse(ordered_tracks=ordered, total_score=round(total_score, 3))
