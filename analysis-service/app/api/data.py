import os

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors.pi_server import PiServerConnector
from app.connectors.sql_server import SqlServerConnector
from app.pipeline.filter import apply_iqr

router = APIRouter(prefix="/data", tags=["data"])


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


class DataRequest(BaseModel):
    source: str  # "pi" | "sql"
    start: str
    end: str
    interval: str = "1h"
    tags: list[str] | None = None  # for PI
    sql: SqlSource | None = None  # for SQL
    iqr: IqrFilter | None = None


def _pi_connector() -> PiServerConnector:
    api_url = os.getenv("PI_API_URL")
    token = os.getenv("PI_TOKEN")
    pi_server = os.getenv("PI_SERVER")
    if not api_url or not token or not pi_server:
        raise RuntimeError("PI ยังไม่ตั้งค่า: ต้องมี PI_API_URL, PI_TOKEN, PI_SERVER ใน .env")
    return PiServerConnector(api_url=api_url, token=token, pi_server=pi_server)


def _to_columnar(df: pd.DataFrame) -> dict:
    if df.empty or "timestamp" not in df.columns:
        return {"timestamps": [], "series": {}}
    ts = pd.to_datetime(df["timestamp"])
    series = {
        col: df[col].where(pd.notna(df[col]), None).tolist()
        for col in df.columns
        if col != "timestamp"
    }
    return {
        "timestamps": ts.dt.strftime("%Y-%m-%dT%H:%M:%S%z").tolist(),
        "series": series,
    }


@router.post("")
def get_data(req: DataRequest):
    tag_meta: dict = {}
    try:
        if req.source == "pi":
            if not req.tags:
                raise ValueError("source=pi ต้องระบุ tags")
            conn = _pi_connector()
            df = conn.fetch(req.tags, req.start, req.end, req.interval)
            tag_meta = getattr(conn, "_last_meta", {}) or {}
        elif req.source == "sql":
            if not req.sql:
                raise ValueError("source=sql ต้องระบุ sql config")
            s = req.sql
            sql_conn = SqlServerConnector(
                host=s.host, user=s.user, password=s.password,
                database=s.database, port=s.port,
            )
            df = sql_conn.fetch_timeseries(
                s.database, s.table, s.timeColumn, s.valueColumn, req.start, req.end
            )
            df = df.rename(columns={"value": s.valueColumn})
        else:
            raise ValueError(f"source ไม่รองรับ: {req.source}")

        rows_before = int(df.shape[0])
        removed = 0
        if req.iqr and req.iqr.enabled:
            value_cols = [c for c in df.columns if c != "timestamp"]
            before = int(df[value_cols].notna().sum().sum())
            df = apply_iqr(df, req.iqr.k)
            after = int(df[value_cols].notna().sum().sum())
            removed = before - after

        out = _to_columnar(df)
        out["meta"] = {
            "source": req.source,
            "rows": len(out["timestamps"]),
            "descriptions": tag_meta,
            "rowsBefore": rows_before,
            "outliersRemoved": removed,
        }
        return out
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))
