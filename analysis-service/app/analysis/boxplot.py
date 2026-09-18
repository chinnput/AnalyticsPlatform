import pandas as pd


def boxplot(df: pd.DataFrame) -> dict:
    """คำนวณ box stats (min, Q1, median, Q3, max) + outliers ต่อ tag."""
    tags: list[str] = []
    boxes: list[list[float]] = []
    outliers: list[dict] = []

    for col in df.columns:
        if col == "timestamp":
            continue
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        if s.empty:
            continue
        q1 = float(s.quantile(0.25))
        q2 = float(s.quantile(0.50))
        q3 = float(s.quantile(0.75))
        iqr = q3 - q1
        low = q1 - 1.5 * iqr
        high = q3 + 1.5 * iqr
        inliers = s[(s >= low) & (s <= high)]
        whisker_low = float(inliers.min()) if not inliers.empty else float(s.min())
        whisker_high = float(inliers.max()) if not inliers.empty else float(s.max())

        idx = len(tags)
        tags.append(col)
        boxes.append(
            [
                round(whisker_low, 4),
                round(q1, 4),
                round(q2, 4),
                round(q3, 4),
                round(whisker_high, 4),
            ]
        )
        for v in s[(s < low) | (s > high)]:
            outliers.append({"index": idx, "value": round(float(v), 4)})

    return {"tags": tags, "boxes": boxes, "outliers": outliers}
