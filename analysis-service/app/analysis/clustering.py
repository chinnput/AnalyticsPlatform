import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def clustering(df: pd.DataFrame, k: int = 3, labels: pd.Series | None = None) -> dict:
    """K-means บนค่าของ tag → คืนจุด (2 tag แรกเป็นแกน) + cluster label ต่อจุด.

    labels (optional): class ต่อแถว → แนบ class ต่อจุด + crosstab cluster × class
    """
    cols = [c for c in df.columns if c != "timestamp"]
    if len(cols) < 2:
        raise ValueError("clustering ต้องมีอย่างน้อย 2 tags")

    numeric = df[cols].apply(pd.to_numeric, errors="coerce").dropna()
    if numeric.shape[0] < k:
        k = max(1, numeric.shape[0])

    scaled = StandardScaler().fit_transform(numeric.to_numpy())
    clusters = KMeans(n_clusters=k, n_init=10, random_state=42).fit_predict(scaled)

    x_tag, y_tag = cols[0], cols[1]
    point_classes = labels.loc[numeric.index].tolist() if labels is not None else None
    points = [
        {
            "x": round(float(row[x_tag]), 4),
            "y": round(float(row[y_tag]), 4),
            "cluster": int(clusters[i]),
            **({"cls": point_classes[i]} if point_classes is not None else {}),
        }
        for i, (_, row) in enumerate(numeric.iterrows())
    ]

    result = {"xTag": x_tag, "yTag": y_tag, "k": int(k), "points": points}
    if point_classes is not None:
        ct = pd.crosstab(pd.Series(clusters, name="cluster"), pd.Series(point_classes, name="cls"))
        result["crosstab"] = {
            "classes": [str(c) for c in ct.columns],
            "rows": [{"cluster": int(c), "counts": [int(v) for v in ct.loc[c]]} for c in ct.index],
        }
    return result
