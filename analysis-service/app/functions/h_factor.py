"""H-factor (Vroom) สำหรับการ cook เยื่อ

rate = exp(a - b / (T_°C + 273.15))      (T เป็นเคลวิน, t เป็นชั่วโมง)
H    = สะสม (rate * dt_ชั่วโมง) ตามเวลา

ค่า default a = 43.2, b = 16113 ตามสูตร Vroom (ยืนยันกับโรงงานแล้ว)
จุดที่อุณหภูมิเป็นค่าว่าง จะคืน None และไม่นับเข้า H สะสม
"""

import math

import numpy as np
import pandas as pd

META = {
    "name": "h_factor",
    "title": "H-factor (Vroom)",
    "params": {
        "temp_tag": {"type": "tag", "label": "อุณหภูมิ (°C)"},
        "a": {"type": "float", "default": 43.2, "label": "ค่าคงที่ a"},
        "b": {"type": "float", "default": 16113, "label": "ค่าคงที่ b"},
    },
    "output": "series",
}


def run(data: dict, params: dict) -> dict:
    ts = pd.to_datetime(pd.Series(data["timestamps"]))
    temp_c = pd.to_numeric(pd.Series(data["series"][params["temp_tag"]]), errors="coerce")
    temp_k = temp_c + 273.15

    dt_hours = ts.diff().dt.total_seconds().div(3600).fillna(0.0)
    rate = np.exp(params["a"] - params["b"] / temp_k)
    h = (rate * dt_hours).fillna(0.0).cumsum()
    h = h.where(temp_c.notna())  # จุดที่ไม่มีอุณหภูมิ → None

    return {
        "kind": "series",
        "timestamps": data["timestamps"],
        "series": {"H-factor": [None if pd.isna(v) else float(v) for v in h]},
    }


_E1 = math.exp(43.2 - 16113 / (100 + 273.15))  # rate ที่ 100 °C

EXAMPLE = {
    "data": {
        "timestamps": ["2026-10-01T08:00:00", "2026-10-01T09:00:00", "2026-10-01T10:00:00"],
        "series": {"TEMP": [100.0, 100.0, 100.0]},
    },
    "params": {"temp_tag": "TEMP"},
    "expected": {
        "kind": "series",
        "timestamps": ["2026-10-01T08:00:00", "2026-10-01T09:00:00", "2026-10-01T10:00:00"],
        "series": {"H-factor": [0.0, _E1, 2 * _E1]},
    },
}
