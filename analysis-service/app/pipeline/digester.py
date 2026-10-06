"""Digester Rule v1 — แบ่ง digester (D1-D4) จาก status tag B1-B4.

กฎเต็ม: docs/digester-rule.md
- แต่ละ tag Bk เทียบกับเลขหม้อตัวเองเท่านั้น: Bk == k -> active, อื่นๆ (รวมค่าใกล้เคียง
  เช่น B2 = 1.95) -> ไม่ active
- รายจุด: active หม้อเดียว -> Dk, ไม่มีหม้อ active -> 0, active หลายหม้อ -> NaN
"""

import numpy as np
import pandas as pd

DIGESTER_TAGS = {
    k: f"PPPC_DP_Cooking.B{k}_Discharge_FinalTime_Press1_Status" for k in range(1, 5)
}
TOL = 1e-6


def assign_digester(df: pd.DataFrame, tol: float = TOL) -> pd.DataFrame:
    """df (timestamp + 4 status columns) -> [timestamp, digester] รายจุด."""
    missing = [c for c in DIGESTER_TAGS.values() if c not in df.columns]
    if missing:
        raise ValueError(f"ไม่มี status tag: {', '.join(missing)}")

    active = pd.DataFrame(
        {
            k: (pd.to_numeric(df[c], errors="coerce") - k).abs() < tol
            for k, c in DIGESTER_TAGS.items()
        }
    )
    n_active = active.sum(axis=1)
    one = n_active == 1

    dig = pd.Series(0.0, index=df.index)
    dig[one] = active[one].idxmax(axis=1)
    dig[n_active > 1] = np.nan

    return pd.DataFrame({"timestamp": pd.to_datetime(df["timestamp"]), "digester": dig})


def quality_report(labels: pd.DataFrame) -> dict:
    """สรุปการแบ่ง: จำนวนจุดต่อหม้อ (D0 = ไม่มีหม้อยืนยัน, NaN = ซ้อนกัน)."""
    dig = labels["digester"].map(lambda v: "NaN" if pd.isna(v) else f"D{int(v)}")
    counts = dig.value_counts().sort_index()
    return {
        "rule": "v1",
        "points": len(labels),
        "byDigester": {k: int(v) for k, v in counts.items()},
    }
