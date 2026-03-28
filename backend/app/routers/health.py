import logging

from fastapi import APIRouter

from app.dependencies import get_supabase_client

router = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check() -> dict:
    checks: dict[str, str] = {}

    # Supabase
    try:
        client = get_supabase_client()
        client.table("users").select("id").limit(1).execute()
        checks["supabase"] = "ok"
    except Exception as e:
        checks["supabase"] = f"error: {e}"

    all_ok = all(v == "ok" for v in checks.values())
    return {"status": "healthy" if all_ok else "degraded", "checks": checks}
