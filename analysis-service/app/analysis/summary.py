import pandas as pd


def summarize(df: pd.DataFrame) -> list[dict]:
    """สรุปสถิติพื้นฐานต่อ tag (คอลัมน์ที่ไม่ใช่ timestamp)."""
    rows: list[dict] = []
    for col in df.columns:
        if col == "timestamp":
            continue
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        if s.empty:
            rows.append(
                {
                    "tag": col,
                    "count": 0,
                    "min": None,
                    "max": None,
                    "mean": None,
                    "median": None,
                    "std": None,
                }
            )
            continue
        rows.append(
            {
                "tag": col,
                "count": int(s.count()),
                "min": round(float(s.min()), 4),
                "max": round(float(s.max()), 4),
                "mean": round(float(s.mean()), 4),
                "median": round(float(s.median()), 4),
                "std": round(float(s.std()), 4),
            }
        )
    return rows
