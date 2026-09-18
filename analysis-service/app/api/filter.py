import os

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors.pi_server import PiServerConnector
from app.pipeline.filter import suggest_iqr

router = APIRouter(prefix="/filter", tags=["filter"])


class SuggestRequest(BaseModel):
    source: str  # "pi"
    start: str
    end: str
    interval: str = "1h"
    tags: list[str] | None = None
    k: float = 1.5


def _pi_connector() -> PiServerConnector:
    api_url = os.getenv("PI_API_URL")
    token = os.getenv("PI_TOKEN")
    pi_server = os.getenv("PI_SERVER")
    if not api_url or not token or not pi_server:
        raise RuntimeError("PI ยังไม่ตั้งค่า: ต้องมี PI_API_URL, PI_TOKEN, PI_SERVER ใน .env")
    return PiServerConnector(api_url=api_url, token=token, pi_server=pi_server)


@router.post("/suggest")
def suggest(req: SuggestRequest):
    try:
        if req.source != "pi" or not req.tags:
            raise ValueError("รองรับ source=pi + tags เท่านั้น")
        df: pd.DataFrame = _pi_connector().fetch(
            req.tags, req.start, req.end, req.interval
        )
        return suggest_iqr(df, req.k)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))
