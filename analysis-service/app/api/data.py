import os

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors.pi_server import PiServerConnector
from app.connectors.sql_server import SqlServerConnector

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


class DataRequest(BaseModel):
    source: str  # "pi" | "sql"
    start: str
    end: str
    interval: str = "1h"
    tags: list[str] | None = None  # for PI
    sql: SqlSource | None = None  # for SQL


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
    try:
        if req.source == "pi":
            if not req.tags:
                raise ValueError("source=pi ต้องระบุ tags")
            df = _pi_connector().fetch(req.tags, req.start, req.end, req.interval)
        elif req.source == "sql":
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
            df = df.rename(columns={"value": s.valueColumn})
        else:
            raise ValueError(f"source ไม่รองรับ: {req.source}")

        out = _to_columnar(df)
        out["meta"] = {"source": req.source, "rows": len(out["timestamps"])}
        return out
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))
