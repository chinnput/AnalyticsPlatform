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
from app.pipeline.digester import DIGESTER_TAGS, assign_digester, quality_report
from app.pipeline.filter import apply_iqr

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


class IqrFilter(BaseModel):
    enabled: bool = False
    k: float = 1.5


class AnalyzeRequest(BaseModel):
    type: str  # "summary" (more types added later)
    source: str  # "pi" | "sql"
    start: str
    end: str
    interval: str = "1h"
    tags: list[str] | None = None
    xTags: list[str] | None = None  # correlation: แกน X
    yTags: list[str] | None = None  # correlation: แกน Y
    valueColumn: str | None = None  # histogram class mode: tag ค่า (kappa)
    classColumn: str | None = None  # histogram class mode: tag แบ่ง class (status)
    classMode: str | None = None  # "digester" = แบ่งตาม Digester Rule v1 (B1-B4)
    sql: SqlSource | None = None
    iqr: IqrFilter | None = None


def _pi_connector() -> PiServerConnector:
    api_url = os.getenv("PI_API_URL")
    token = os.getenv("PI_TOKEN")
    pi_server = os.getenv("PI_SERVER")
    if not api_url or not token or not pi_server:
        raise RuntimeError("PI ยังไม่ตั้งค่า: ต้องมี PI_API_URL, PI_TOKEN, PI_SERVER ใน .env")
    return PiServerConnector(api_url=api_url, token=token, pi_server=pi_server)


def _fetch(req: AnalyzeRequest) -> pd.DataFrame:
    if req.source == "pi":
        tags = req.tags
        if req.xTags or req.yTags:
            merged = list(dict.fromkeys((req.xTags or []) + (req.yTags or [])))
            tags = merged or tags
        if req.valueColumn and req.classColumn:
            tags = list(dict.fromkeys([req.valueColumn, req.classColumn]))
        if not tags:
            raise ValueError("source=pi ต้องระบุ tags")
        return _pi_connector().fetch(tags, req.start, req.end, req.interval)
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


def _fetch_chunked(
    tags: list[str], start: str, end: str, interval: str, chunk_days: int = 7
) -> pd.DataFrame:
    """ดึง PI แบ่งเป็นก้อนละ chunk_days วัน (กัน request ใหญ่เกิน timeout เมื่อ interval ละเอียด)."""
    conn = _pi_connector()
    t0, t_end = pd.Timestamp(start), pd.Timestamp(end)
    frames: list[pd.DataFrame] = []
    while t0 < t_end:
        t1 = min(t0 + pd.Timedelta(days=chunk_days), t_end)
        frames.append(conn.fetch(tags, str(t0), str(t1), interval))
        t0 = t1
    df = pd.concat(frames, ignore_index=True)
    return df.drop_duplicates(subset="timestamp").sort_values("timestamp").reset_index(drop=True)


def _histogram_digester(req: AnalyzeRequest) -> dict:
    """Histogram ของ tags[0] แบ่งตาม Digester Rule v1 (ดู docs/digester-rule.md).

    ดึงด้วย interval ที่เลือก แล้วตัดสินหม้อรายจุด (ไม่รวมเป็นช่วง)
    """
    if req.source != "pi" or not req.tags:
        raise ValueError("แบ่งตาม digester รองรับ source=pi + เลือก value tag")
    value_col = req.tags[0]
    df = _fetch_chunked(
        [value_col, *DIGESTER_TAGS.values()], req.start, req.end, req.interval
    )
    if value_col not in df.columns:
        return {"series": [], "quality": None}
    if req.iqr and req.iqr.enabled:
        # กรองเฉพาะ value tag — ห้ามกรอง status tag
        df[value_col] = apply_iqr(df[["timestamp", value_col]], req.iqr.k)[value_col]

    labels = assign_digester(df)
    points = pd.DataFrame(
        {"value": pd.to_numeric(df[value_col], errors="coerce"), "digester": labels["digester"]}
    )
    result = histogram(
        points[points["digester"] > 0],
        value_col="value",
        class_col="digester",
        class_prefix="D",
    )
    result["quality"] = quality_report(labels)
    return result


@router.post("")
def analyze(req: AnalyzeRequest):
    try:
        if req.type == "histogram" and req.classMode == "digester":
            return {"type": "histogram", "result": _histogram_digester(req)}
        df = _fetch(req)
        if req.iqr and req.iqr.enabled:
            df = apply_iqr(df, req.iqr.k)
        if req.type == "summary":
            return {"type": "summary", "result": summarize(df)}
        if req.type == "boxplot":
            return {"type": "boxplot", "result": boxplot(df)}
        if req.type == "correlation":
            return {
                "type": "correlation",
                "result": correlation(df, req.xTags, req.yTags),
            }
        if req.type == "sd":
            return {"type": "sd", "result": sd_band(df)}
        if req.type == "kde":
            return {"type": "kde", "result": kde(df)}
        if req.type == "histogram":
            return {
                "type": "histogram",
                "result": histogram(
                    df, value_col=req.valueColumn, class_col=req.classColumn
                ),
            }
        if req.type == "clustering":
            return {"type": "clustering", "result": clustering(df)}
        raise ValueError(f"analysis type ไม่รองรับ: {req.type}")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))
