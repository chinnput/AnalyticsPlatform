import pandas as pd


def correlation(df: pd.DataFrame) -> dict:
    """Pearson correlation matrix ระหว่าง tag (คอลัมน์ที่ไม่ใช่ timestamp)."""
    cols = [c for c in df.columns if c != "timestamp"]
    numeric = df[cols].apply(pd.to_numeric, errors="coerce")
    corr = numeric.corr(method="pearson")

    matrix: list[list[float | None]] = []
    for r in cols:
        row: list[float | None] = []
        for c in cols:
            v = corr.loc[r, c]
            row.append(None if pd.isna(v) else round(float(v), 4))
        matrix.append(row)

    return {"tags": cols, "matrix": matrix}
