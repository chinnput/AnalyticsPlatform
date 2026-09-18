import numpy as np
import pandas as pd


def histogram(df: pd.DataFrame, bins: int = 30) -> dict:
    """แจกแจงความถี่ (histogram) ต่อ tag คืน bin center + count ต่อ tag."""
    series: list[dict] = []

    for col in df.columns:
        if col == "timestamp":
            continue
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        if s.size < 2:
            continue
        arr = s.to_numpy()
        counts, edges = np.histogram(arr, bins=bins)
        centers = (edges[:-1] + edges[1:]) / 2
        series.append(
            {
                "tag": col,
                "x": [round(float(v), 4) for v in centers],
                "y": [int(v) for v in counts],
            }
        )

    return {"series": series}
