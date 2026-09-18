import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors.pi_server import PiServerConnector

router = APIRouter(prefix="/pi", tags=["pi"])


class FetchRequest(BaseModel):
    tags: list[str]
    start: str
    end: str
    interval: str = "1h"


def _connector() -> PiServerConnector:
    api_url = os.getenv("PI_API_URL")
    token = os.getenv("PI_TOKEN")
    pi_server = os.getenv("PI_SERVER")
    if not api_url or not token or not pi_server:
        raise RuntimeError(
            "PI ยังไม่ตั้งค่า: ต้องมี PI_API_URL, PI_TOKEN, PI_SERVER ใน .env"
        )
    return PiServerConnector(api_url=api_url, token=token, pi_server=pi_server)


@router.post("/test")
def test_connection():
    try:
        _connector().test()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/fetch")
def fetch(req: FetchRequest):
    try:
        df = _connector().fetch(req.tags, req.start, req.end, req.interval)
        return {"rows": df.to_dict(orient="records")}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))
