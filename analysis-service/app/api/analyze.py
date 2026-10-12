import os

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.analysis.boxplot import boxplot
from app.analysis.clustering import clustering
from app.analysis.correlation import correlation
from app.analysis.histogram import histogram, histogram_by_class
from app.analysis.kde import kde
from app.analysis.sd import sd_band
from app.analysis.summary import summarize
from app.connectors import file_source
from app.connectors.pi_server import PiServerConnector
from app.connectors.sql_server import SqlServerConnector
from app.pipeline.classify import class_labels, class_tags, classify
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
    project: str | None = None  # ต้องมีเมื่อใช้ tag จากไฟล์ ("file:<id>/<col>")
    xTags: list[str] | None = None  # correlation: แกน X
    yTags: list[str] | None = None  # correlation: แกน Y
    classSpec: "ClassSpec | None" = None  # แบ่ง class (ดู app/pipeline/classify.py)
    sql: SqlSource | None = None
    iqr: IqrFilter | None = None


class ClassSpec(BaseModel):
    definition: dict  # class definition จาก project
    mode: str = "filter"  # "filter" = ใช้เฉพาะ class ที่เลือก | "split" = แยกผลตาม class
    include: list[str] | None = None  # class ที่เลือก (None = ทุก class)


AnalyzeRequest.model_rebuild()

# analysis ที่ใช้ class ได้
CLASS_TYPES = {"summary", "boxplot", "histogram", "kde", "sd", "correlation", "clustering"}


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
        if not tags:
            raise ValueError("source=pi ต้องระบุ tags")
        return file_source.fetch_tags(
            req.project, tags, req.start, req.end, req.interval,
            lambda *a: _pi_connector().fetch(*a),
        )
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
    tags: list[str], start: str, end: str, interval: str, project: str | None = None
) -> pd.DataFrame:
    return file_source.fetch_tags(
        project, tags, start, end, interval,
        lambda *a: _pi_connector().fetch_chunked(*a),
    )


_ANALYZERS = {
    "summary": summarize,
    "boxplot": boxplot,
    "kde": kde,
    "histogram": histogram,
    "sd": sd_band,
}


def _analyze_with_class(req: AnalyzeRequest) -> dict:
    """ดึง value tags + class tags (interval เดียวกัน) → แบ่ง class → filter หรือ split.

    ตัดอัตโนมัติ: class ที่ไม่ได้เลือก, noneLabel, NaN (ซ้อน/ระบุไม่ได้)
    """
    spec = req.classSpec
    if req.type not in CLASS_TYPES:
        raise ValueError(f"{req.type} ยังไม่รองรับการแบ่ง class")
    if spec.mode not in ("filter", "split"):
        raise ValueError(f"class mode ไม่รองรับ: {spec.mode}")
    if req.type == "correlation" and spec.mode != "filter":
        raise ValueError("correlation รองรับเฉพาะ class mode = filter")
    value_tags = (
        list(dict.fromkeys((req.xTags or []) + (req.yTags or [])))
        if req.type == "correlation"
        else list(req.tags or [])
    )
    if req.source != "pi" or not value_tags:
        raise ValueError("การแบ่ง class รองรับ source=pi + เลือก tag")

    df = _fetch_chunked(
        list(dict.fromkeys(value_tags + class_tags(spec.definition))),
        req.start, req.end, req.interval, req.project,
    )
    labels = classify(df, spec.definition)
    counts = labels.fillna("NaN").value_counts()
    class_info = {"points": int(len(labels)), "counts": {k: int(v) for k, v in counts.items()}}

    value_tags = [t for t in value_tags if t in df.columns]
    data = df[["timestamp", *value_tags]].copy()
    if req.iqr and req.iqr.enabled:
        # กรองเฉพาะ value tag — ห้ามกรอง class tag
        data = apply_iqr(data, req.iqr.k)

    order = [c for c in class_labels(spec.definition) if spec.include is None or c in spec.include]
    keep = labels.isin(order)
    class_info["used"] = order

    if req.type == "correlation":
        return {
            "result": correlation(data[keep], req.xTags, req.yTags),
            "classInfo": class_info,
        }
    if req.type == "clustering":
        # filter = k-means เฉพาะ class ที่เลือก · split = เหมือนกัน + แนบ class ต่อจุด/crosstab
        result = clustering(data[keep], labels=labels[keep] if spec.mode == "split" else None)
        return {"result": result, "classInfo": class_info}
    if spec.mode == "filter":
        return {"result": _ANALYZERS[req.type](data[keep]), "classInfo": class_info}

    # split
    if req.type == "histogram":
        tag = value_tags[0]
        result = histogram_by_class(data.loc[keep, tag], labels[keep], order)
        return {"result": result, "classInfo": class_info}
    # วิเคราะห์ทีละ class: แยกเป็น column "tag · class" (ค่านอก class = NaN)
    wide = pd.DataFrame({"timestamp": data["timestamp"]})
    for tag in value_tags:
        for label in order:
            wide[f"{tag} · {label}"] = data[tag].where(labels == label)
    return {"result": _ANALYZERS[req.type](wide[keep]), "classInfo": class_info}


@router.post("")
def analyze(req: AnalyzeRequest):
    try:
        if req.classSpec:
            return {"type": req.type, **_analyze_with_class(req)}
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
            return {"type": "histogram", "result": histogram(df)}
        if req.type == "clustering":
            return {"type": "clustering", "result": clustering(df)}
        raise ValueError(f"analysis type ไม่รองรับ: {req.type}")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))
