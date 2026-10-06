import numpy as np
import pandas as pd


def histogram(
    df: pd.DataFrame,
    bins: int = 30,
    value_col: str | None = None,
    class_col: str | None = None,
    class_prefix: str | None = None,
) -> dict:
    """แจกแจงความถี่ (histogram).

    - โหมดปกติ: ทำ histogram ต่อ tag (ทุก column ยกเว้น timestamp)
    - โหมด class: ถ้าระบุ value_col + class_col จะแบ่ง value ตามค่า class
      (เช่น status 0-4) แล้วทำ histogram ต่อ class โดยใช้ bin edges ร่วมกัน
      เพื่อให้ซ้อนกัน (overlay) ได้ตรง x-axis
    """
    if value_col and class_col:
        return _histogram_by_class(df, value_col, class_col, bins, class_prefix)

    series: list[dict] = []
    for col in df.columns:
        if col == "timestamp":
            continue
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        if s.size < 2:
            continue
        counts, edges = np.histogram(s.to_numpy(), bins=bins)
        centers = (edges[:-1] + edges[1:]) / 2
        series.append(
            {
                "tag": col,
                "x": [round(float(v), 4) for v in centers],
                "y": [int(v) for v in counts],
            }
        )
    return {"series": series}


def _histogram_by_class(
    df: pd.DataFrame,
    value_col: str,
    class_col: str,
    bins: int,
    prefix: str | None = None,
) -> dict:
    """แบ่ง value_col ตามค่า class_col แล้วทำ histogram ต่อ class (bin ร่วมกัน).

    prefix: ชื่อ series เป็น f"{prefix}{cls}" (เช่น "D1") แทน f"{class_col}={cls}"
    """
    if value_col not in df.columns or class_col not in df.columns:
        return {"series": []}

    values = pd.to_numeric(df[value_col], errors="coerce")
    # status จาก PI อาจเป็น interpolated ทศนิยม → ปัดเป็น int ให้ได้ class ชัดเจน
    classes = pd.to_numeric(df[class_col], errors="coerce").round()

    pair = pd.DataFrame({"value": values, "cls": classes}).dropna()
    if pair.shape[0] < 2:
        return {"series": []}

    edges = np.histogram_bin_edges(pair["value"].to_numpy(), bins=bins)
    centers = (edges[:-1] + edges[1:]) / 2
    x = [round(float(v), 4) for v in centers]

    series: list[dict] = []
    for cls in sorted(pair["cls"].unique()):
        sub = pair.loc[pair["cls"] == cls, "value"].to_numpy()
        if sub.size == 0:
            continue
        counts, _ = np.histogram(sub, bins=edges)
        series.append(
            {
                "tag": f"{prefix}{int(cls)}" if prefix else f"{class_col}={int(cls)}",
                "x": x,
                "y": [int(v) for v in counts],
            }
        )
    return {"series": series}
