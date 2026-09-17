from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "analysis-service",
        "version": "0.1.0",
        "time": datetime.now(timezone.utc).isoformat(),
    }
