"""แบ่ง class ตาม class definition (เก็บใน project, ส่งมากับ request).

รองรับ 3 type:
- one-hot   : หลาย tag แต่ละ tag บอกว่า class ตัวเอง active ไหม (เช่น Digester B1-B4)
              {"classes": [{"label", "tag", "activeValue"}], "noneLabel"?, "tolerance"?}
              active หนึ่งเดียว -> label, ไม่มี -> noneLabel, ซ้อน -> NaN
              ค่าที่ไม่เท่ากับ activeValue (รวมค่าใกล้เคียง เช่น 1.95) = ไม่ active
- value-map : tag เดียว ค่าแต่ละค่าคือ class
              {"tag", "map": [{"value", "label"}], "noneLabel"?, "tolerance"?}
- range     : tag ต่อเนื่อง แบ่งตามช่วง (min <= ค่า < max, None = ไม่จำกัด)
              {"tag", "bins": [{"label", "min"?, "max"?}], "noneLabel"?}
"""

import numpy as np
import pandas as pd

TOL = 1e-6


def class_tags(definition: dict) -> list[str]:
    """tag ที่ต้องดึงเพื่อแบ่ง class."""
    t = definition.get("type")
    if t == "one-hot":
        return [c["tag"] for c in definition.get("classes", [])]
    if t in ("value-map", "range"):
        return [definition["tag"]]
    raise ValueError(f"class type ไม่รองรับ: {t}")


def class_labels(definition: dict) -> list[str]:
    """label ทั้งหมดตามลำดับใน definition (ไม่รวม noneLabel)."""
    t = definition.get("type")
    items = {
        "one-hot": definition.get("classes", []),
        "value-map": definition.get("map", []),
        "range": definition.get("bins", []),
    }.get(t, [])
    return list(dict.fromkeys(str(i["label"]) for i in items))


def _num(df: pd.DataFrame, tag: str) -> pd.Series:
    if tag not in df.columns:
        raise ValueError(f"ไม่มีข้อมูลของ class tag: {tag}")
    return pd.to_numeric(df[tag], errors="coerce")


def classify(df: pd.DataFrame, definition: dict) -> pd.Series:
    """คืน label ต่อแถว (object; NaN = ระบุไม่ได้/ซ้อนกัน)."""
    t = definition.get("type")
    tol = float(definition.get("tolerance", TOL))
    none = definition.get("noneLabel")
    out = pd.Series(none if none else np.nan, index=df.index, dtype=object)

    if t == "one-hot":
        classes = definition.get("classes", [])
        active = pd.DataFrame(
            {i: (_num(df, c["tag"]) - float(c["activeValue"])).abs() < tol for i, c in enumerate(classes)}
        )
        n = active.sum(axis=1)
        one = n == 1
        labels = np.array([str(c["label"]) for c in classes], dtype=object)
        out[one] = labels[active[one].to_numpy().argmax(axis=1)]
        out[n > 1] = np.nan
        return out

    if t == "value-map":
        v = _num(df, definition["tag"])
        assigned = pd.Series(False, index=df.index)
        for m in definition.get("map", []):
            mask = ((v - float(m["value"])).abs() < tol) & ~assigned
            out[mask] = str(m["label"])
            assigned |= mask
        out[v.isna()] = np.nan
        return out

    if t == "range":
        v = _num(df, definition["tag"])
        assigned = pd.Series(False, index=df.index)
        for b in definition.get("bins", []):
            lo = -np.inf if b.get("min") is None else float(b["min"])
            hi = np.inf if b.get("max") is None else float(b["max"])
            mask = (v >= lo) & (v < hi) & ~assigned
            out[mask] = str(b["label"])
            assigned |= mask
        out[v.isna()] = np.nan
        return out

    raise ValueError(f"class type ไม่รองรับ: {t}")
