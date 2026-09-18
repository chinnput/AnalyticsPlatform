import os

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.analysis.boxplot import boxplot
from app.analysis.clustering import clustering
from app.analysis.correlation import correlation
from app.analysis.histogram import histogram
from app.analysis.kde import kde
from app.analysis.sd import sd_band
from app.analysis.summary import summarize
from app.connectors.pi_server import PiServerConnector
from app.connectors.sql_server import SqlServerConnector

router = APIRouter(prefix="/analyze", tags=["analyze"])


class SqlSource(BaseModel):
    host: str
    user: str
    password: str
    database: str
    table: str
    timeColumn: str
    valueColumn: str
    port: int = 1433


class AnalyzeRequest(BaseModel):
    type: str  # "summary" (more types added later)
    source: str  # "pi" | "sql"
    start: str
    end: str
    interval: str = "1h"
    tags: list[str] | None = None
    sql: SqlSource | None = None


def _pi_connector() -> PiServerConnector:
    api_url = os.getenv("PI_API_URL")
    token = os.getenv("PI_TOKEN")
    pi_server = os.getenv("PI_SERVER")
    if not api_url or not token or not pi_server:
        raise RuntimeError("PI ยังไม่ตั้งค่า: ต้องมี PI_API_URL, PI_TOKEN, PI_SERVER ใน .env")
    return PiServerConnector(api_url=api_url, token=token, pi_server=pi_server)


def _fetch(req: AnalyzeRequest) -> pd.DataFrame:
    if req.source == "pi":
        if not req.tags:
            raise ValueError("source=pi ต้องระบุ tags")
        return _pi_connector().fetch(req.tags, req.start, req.end, req.interval)
    if req.source == "sql":
        if not req.sql:
            raise ValueError("source=sql ต้องระบุ sql config")
        s = req.sql
        conn = SqlServerConnector(
            host=s.host, user=s.user, password=s.password,
            database=s.database, port=s.port,
        )
        df = conn.fetch_timeseries(
            s.database, s.table, s.timeColumn, s.valueColumn, req.start, req.end
        )
        return df.rename(columns={"value": s.valueColumn})
    raise ValueError(f"source ไม่รองรับ: {req.source}")


@router.post("")
def analyze(req: AnalyzeRequest):
    try:
        df = _fetch(req)
        if req.type == "summary":
            return {"type": "summary", "result": summarize(df)}
        if req.type == "boxplot":
            return {"type": "boxplot", "result": boxplot(df)}
        if req.type == "correlation":
            return {"type": "correlation", "result": correlation(df)}
        if req.type == "sd":
            return {"type": "sd", "result": sd_band(df)}
        if req.type == "kde":
            return {"type": "kde", "result": kde(df)}
        if req.type == "histogram":
            return {"type": "histogram", "result": histogram(df)}
        if req.type == "clustering":
            return {"type": "clustering", "result": clustering(df)}
        raise ValueError(f"analysis type ไม่รองรับ: {req.type}")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))
