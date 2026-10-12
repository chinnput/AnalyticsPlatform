import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def elbow_k(scaled: np.ndarray, k_min: int = 2, k_max: int = 10) -> tuple[int, list[dict]]:
    """เลือก k ด้วย Elbow method (จุดที่ห่างจากเส้นตรงของ inertia curve มากที่สุด).

    คืน (k ที่เลือก, [{"k", "inertia"}, ...]) — ข้อมูลน้อยเกินจะหา elbow ไม่ได้ คืน k_min
    """
    k_max = min(k_max, scaled.shape[0])
    if k_max < k_min:
        return max(1, k_max), []

    ks = list(range(k_min, k_max + 1))
    inertias = [float(KMeans(n_clusters=k, n_init=10, random_state=42).fit(scaled).inertia_) for k in ks]
    curve = [{"k": k, "inertia": round(i, 4)} for k, i in zip(ks, inertias)]
    if len(ks) < 3 or inertias[0] == inertias[-1]:
        return ks[0], curve

    # normalize ให้ x (k) และ y (inertia) อยู่ในช่วง 0–1 — เส้นตรงจาก (0,1) ถึง (1,0)
    xs = np.array([(k - ks[0]) / (ks[-1] - ks[0]) for k in ks])
    ys = np.array([(i - inertias[-1]) / (inertias[0] - inertias[-1]) for i in inertias])
    # จุดที่อยู่ใต้เส้นมากที่สุด (1 - x - y สูงสุด) = elbow
    gaps = 1 - xs - ys
    return ks[int(np.argmax(gaps))], curve


def clustering(df: pd.DataFrame, k: int | None = None, labels: pd.Series | None = None) -> dict:
    """K-means บนค่าของ tag → คืนจุด (2 tag แรกเป็นแกน) + cluster label ต่อจุด.

    k=None → เลือกอัตโนมัติด้วย Elbow method (คืน elbow curve ใน result["elbow"])
    labels (optional): class ต่อแถว → แนบ class ต่อจุด + crosstab cluster × class
    """
    cols = [c for c in df.columns if c != "timestamp"]
    if len(cols) < 2:
        raise ValueError("clustering ต้องมีอย่างน้อย 2 tags")

    numeric = df[cols].apply(pd.to_numeric, errors="coerce").dropna()
    scaled = StandardScaler().fit_transform(numeric.to_numpy())

    elbow = None
    if k is None:
        k, curve = elbow_k(scaled)
        elbow = {"chosen": int(k), "curve": curve}
    elif numeric.shape[0] < k:
        k = max(1, numeric.shape[0])

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
    if elbow is not None:
        result["elbow"] = elbow
    if point_classes is not None:
        ct = pd.crosstab(pd.Series(clusters, name="cluster"), pd.Series(point_classes, name="cls"))
        result["crosstab"] = {
            "classes": [str(c) for c in ct.columns],
            "rows": [{"cluster": int(c), "counts": [int(v) for v in ct.loc[c]]} for c in ct.index],
        }
    return result
