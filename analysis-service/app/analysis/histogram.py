import numpy as np
import pandas as pd


def histogram(df: pd.DataFrame, bins: int = 30) -> dict:
    """แจกแจงความถี่ (histogram) ต่อ tag (ทุก column ยกเว้น timestamp)."""
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


def histogram_by_class(
    values: pd.Series,
    classes: pd.Series,
    order: list[str],
    bins: int = 30,
    name=lambda label: label,
) -> dict:
    """แบ่ง values ตาม class label แล้วทำ histogram ต่อ class.

    ใช้ bin edges ร่วมกันทุก class เพื่อให้ซ้อนกัน (overlay) ได้ตรง x-axis
    order: ลำดับ class ที่จะแสดง · name: ตั้งชื่อ series จาก label
    """
    pair = pd.DataFrame(
        {"value": pd.to_numeric(values, errors="coerce"), "cls": classes}
    ).dropna()
    if pair.shape[0] < 2:
        return {"series": []}

    edges = np.histogram_bin_edges(pair["value"].to_numpy(), bins=bins)
    centers = (edges[:-1] + edges[1:]) / 2
    x = [round(float(v), 4) for v in centers]

    series: list[dict] = []
    for label in order:
        sub = pair.loc[pair["cls"] == label, "value"].to_numpy()
        if sub.size == 0:
            continue
        counts, _ = np.histogram(sub, bins=edges)
        series.append({"tag": name(label), "x": x, "y": [int(v) for v in counts]})
    return {"series": series}
