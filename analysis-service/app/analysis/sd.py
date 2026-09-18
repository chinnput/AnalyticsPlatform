import pandas as pd


def sd_band(df: pd.DataFrame) -> dict:
    """คำนวณ mean + SD band (±1σ, ±2σ) ต่อ tag พร้อม series ค่าจริงตามเวลา."""
    ts = df["timestamp"].astype(str).tolist() if "timestamp" in df.columns else []
    series: list[dict] = []

    for col in df.columns:
        if col == "timestamp":
            continue
        s = pd.to_numeric(df[col], errors="coerce")
        clean = s.dropna()
        if clean.empty:
            continue
        mean = float(clean.mean())
        std = float(clean.std())
        values = [None if pd.isna(v) else round(float(v), 4) for v in s.tolist()]
        series.append(
            {
                "tag": col,
                "mean": round(mean, 4),
                "std": round(std, 4),
                "upper1": round(mean + std, 4),
                "lower1": round(mean - std, 4),
                "upper2": round(mean + 2 * std, 4),
                "lower2": round(mean - 2 * std, 4),
                "values": values,
            }
        )

    return {"timestamps": ts, "series": series}
