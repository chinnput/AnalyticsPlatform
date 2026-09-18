import numpy as np
import pandas as pd
from scipy.stats import gaussian_kde


def kde(df: pd.DataFrame, points: int = 100) -> dict:
    """ประเมิน density curve (KDE) ต่อ tag บน grid ค่าเดียวกันของแต่ละ tag."""
    curves: list[dict] = []

    for col in df.columns:
        if col == "timestamp":
            continue
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        if s.size < 2 or float(s.std()) == 0:
            continue
        arr = s.to_numpy()
        grid = np.linspace(arr.min(), arr.max(), points)
        density = gaussian_kde(arr)(grid)
        curves.append(
            {
                "tag": col,
                "x": [round(float(v), 4) for v in grid],
                "y": [round(float(v), 6) for v in density],
            }
        )

    return {"curves": curves}
