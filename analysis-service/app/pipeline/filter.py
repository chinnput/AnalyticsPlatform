import numpy as np
import pandas as pd


def _value_columns(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c != "timestamp"]


def iqr_bounds(series: pd.Series, k: float = 1.5) -> tuple[float, float]:
    """คืนขอบล่าง/บนของ IQR: [Q1 - k*IQR, Q3 + k*IQR]."""
    s = pd.to_numeric(series, errors="coerce").dropna()
    q1 = float(s.quantile(0.25))
    q3 = float(s.quantile(0.75))
    iqr = q3 - q1
    return q1 - k * iqr, q3 + k * iqr


def suggest_iqr(df: pd.DataFrame, k: float = 1.5) -> dict:
    """แนะนำค่า k + จำนวนจุด outlier ที่จะถูกตัดต่อ tag (ไม่แก้ข้อมูล)."""
    tags: list[dict] = []
    for col in _value_columns(df):
        s = pd.to_numeric(df[col], errors="coerce")
        valid = s.dropna()
        if valid.size < 4:
            tags.append(
                {"tag": col, "total": int(valid.size), "outliers": 0,
                 "lower": None, "upper": None}
            )
            continue
        lower, upper = iqr_bounds(valid, k)
        mask = (valid < lower) | (valid > upper)
        tags.append(
            {
                "tag": col,
                "total": int(valid.size),
                "outliers": int(mask.sum()),
                "lower": round(lower, 4),
                "upper": round(upper, 4),
            }
        )
    return {"method": "iqr", "k": k, "tags": tags}


def apply_iqr(df: pd.DataFrame, k: float = 1.5) -> pd.DataFrame:
    """แทนค่า outlier (นอกขอบ IQR) เป็น NaN ต่อ tag แล้วคืน df ใหม่."""
    out = df.copy()
    for col in _value_columns(out):
        s = pd.to_numeric(out[col], errors="coerce")
        valid = s.dropna()
        if valid.size < 4:
            continue
        lower, upper = iqr_bounds(valid, k)
        out[col] = s.where((s >= lower) & (s <= upper), np.nan)
    return out
