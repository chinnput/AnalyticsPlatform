import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def clustering(df: pd.DataFrame, k: int = 3) -> dict:
    """K-means บนค่าของ tag → คืนจุด (2 tag แรกเป็นแกน) + cluster label ต่อจุด."""
    cols = [c for c in df.columns if c != "timestamp"]
    if len(cols) < 2:
        raise ValueError("clustering ต้องมีอย่างน้อย 2 tags")

    numeric = df[cols].apply(pd.to_numeric, errors="coerce").dropna()
    if numeric.shape[0] < k:
        k = max(1, numeric.shape[0])

    scaled = StandardScaler().fit_transform(numeric.to_numpy())
    labels = KMeans(n_clusters=k, n_init=10, random_state=42).fit_predict(scaled)

    x_tag, y_tag = cols[0], cols[1]
    points = [
        {
            "x": round(float(row[x_tag]), 4),
            "y": round(float(row[y_tag]), 4),
            "cluster": int(labels[i]),
        }
        for i, (_, row) in enumerate(numeric.iterrows())
    ]

    return {"xTag": x_tag, "yTag": y_tag, "k": int(k), "points": points}
