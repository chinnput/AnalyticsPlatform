import os

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors import file_source
from app.connectors.pi_server import PiServerConnector
from app.connectors.sql_server import SqlServerConnector
from app.pipeline.classify import class_labels, class_tags, classify
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


class ChartClassSpec(BaseModel):
    definition: dict  # class definition จาก project
    mode: str = "shade"  # "shade" = คืน class ต่อจุดไว้ระบายพื้นหลัง | "filter" = ค่านอก class เป็น null
    include: list[str] | None = None  # class ที่เลือก (None = ทุก class)


class DataRequest(BaseModel):
    source: str  # "pi" | "sql"
    start: str
    end: str
    interval: str = "1h"
    tags: list[str] | None = None  # PI tag หรือ tag จากไฟล์ ("file:<id>/<col>")
    project: str | None = None  # ต้องมีเมื่อใช้ tag จากไฟล์
    sql: SqlSource | None = None  # for SQL
    iqr: IqrFilter | None = None
    classSpec: ChartClassSpec | None = None


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
    # NaN → None (JSON null); ต้องแปลงเป็น object ก่อน ไม่งั้น float column จะคืน NaN
    series = {
        col: df[col].astype(object).where(pd.notna(df[col]), None).tolist()
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
    classes: list | None = None
    try:
        if req.source == "pi":
            if not req.tags:
                raise ValueError("source=pi ต้องระบุ tags")
            # tag จากไฟล์ ("file:...") อ่านจากไฟล์ใน project, ที่เหลืออ่านจาก PI
            conn = None

            def pi(method):
                def run(*a):
                    nonlocal conn
                    conn = conn or _pi_connector()
                    return getattr(conn, method)(*a)
                return run

            if req.classSpec:
                spec = req.classSpec
                if spec.mode not in ("shade", "filter"):
                    raise ValueError(f"class mode ไม่รองรับ: {spec.mode}")
                fetch_tags = list(dict.fromkeys(req.tags + class_tags(spec.definition)))
                df = file_source.fetch_tags(
                    req.project, fetch_tags, req.start, req.end, req.interval, pi("fetch_chunked")
                )
                labels = classify(df, spec.definition)
                order = [
                    c for c in class_labels(spec.definition)
                    if spec.include is None or c in spec.include
                ]
                keep = labels.isin(order)
                # เก็บเฉพาะ tag ที่ผู้ใช้เลือก (class tag ที่ไม่ได้เลือกไม่ต้องแสดง)
                df = df[["timestamp", *[t for t in req.tags if t in df.columns]]].copy()
                if spec.mode == "filter":
                    value_cols = [c for c in df.columns if c != "timestamp"]
                    df[value_cols] = df[value_cols].where(keep, axis=0)
                classes = [str(c) if k else None for c, k in zip(labels, keep)]
            else:
                df = file_source.fetch_tags(
                    req.project, req.tags, req.start, req.end, req.interval, pi("fetch")
                )
            if conn is not None:
                tag_meta = getattr(conn, "_last_meta", {}) or {}
            else:
                # tag จากไฟล์: description = ชื่อ column
                tag_meta = {t: {"description": file_source.split_tag(t)[1]} for t in req.tags}
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
        if classes is not None:
            out["classes"] = classes  # class ต่อ timestamp (null = ไม่อยู่ใน class ที่เลือก)
        return out
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))
