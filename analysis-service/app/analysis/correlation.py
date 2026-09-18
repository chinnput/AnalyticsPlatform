import pandas as pd


def correlation(
    df: pd.DataFrame,
    x_tags: list[str] | None = None,
    y_tags: list[str] | None = None,
) -> dict:
    """Pearson correlation heatmap.

    ถ้าไม่ระบุ x_tags/y_tags → matrix จตุรัสของทุก tag (สมมาตร).
    ถ้าระบุ → heatmap สี่เหลี่ยม rows=y_tags, cols=x_tags.
    """
    cols = [c for c in df.columns if c != "timestamp"]
    numeric = df[cols].apply(pd.to_numeric, errors="coerce")
    corr = numeric.corr(method="pearson")

    x_cols = [c for c in (x_tags or cols) if c in cols]
    y_cols = [c for c in (y_tags or cols) if c in cols]

    matrix: list[list[float | None]] = []
    for r in y_cols:
        row: list[float | None] = []
        for c in x_cols:
            v = corr.loc[r, c]
            row.append(None if pd.isna(v) else round(float(v), 4))
        matrix.append(row)

    return {"xTags": x_cols, "yTags": y_cols, "matrix": matrix}
