"""Data source จากไฟล์ CSV / Excel ที่อัปโหลดเข้า project (read-only).

ไฟล์อยู่ที่ web/data/projects/<project>/files/<fileId>.<ext>
- ingest: อ่านไฟล์ครั้งเดียว → แปลงเวลา/ตัวเลข → เขียน cache <fileId>.pkl (โหลดเร็ว)
- tag ของไฟล์ = "file:<fileId>/<column>"
- fetch: ใช้ค่า ณ ต้นช่วงของแต่ละ interval (เหมือน snapshot ของ PI) ถ้า interval หยาบกว่าข้อมูล
"""

import os
import re
from functools import lru_cache
from pathlib import Path

import pandas as pd

# อ่านได้เฉพาะใต้ web/data/projects (กันอ่าน path อื่น)
PROJECTS_ROOT = Path(
    os.getenv("PROJECTS_DIR")
    or Path(__file__).resolve().parents[3] / "web" / "data" / "projects"
).resolve()

FILE_PREFIX = "file:"
EXTS = {".csv", ".xlsx"}
FREQ = {"1m": "1min", "5m": "5min", "15m": "15min", "1h": "1h", "1d": "1D"}
_ID_RE = re.compile(r"^[a-z0-9-]+$")


def is_file_tag(tag: str) -> bool:
    return tag.startswith(FILE_PREFIX)


def split_tag(tag: str) -> tuple[str, str]:
    """"file:<fileId>/<column>" -> (fileId, column)."""
    file_id, _, column = tag[len(FILE_PREFIX):].partition("/")
    if not file_id or not column:
        raise ValueError(f"file tag ไม่ถูกต้อง: {tag}")
    return file_id, column


def _files_dir(project: str) -> Path:
    if not _ID_RE.match(project or ""):
        raise ValueError("project id ไม่ถูกต้อง")
    d = (PROJECTS_ROOT / project / "files").resolve()
    if PROJECTS_ROOT not in d.parents:
        raise ValueError("path ไม่อยู่ใน projects")
    return d


def _source_path(project: str, file_id: str, ext: str) -> Path:
    if not _ID_RE.match(file_id) or ext not in EXTS:
        raise ValueError("ไฟล์ไม่ถูกต้อง")
    return _files_dir(project) / f"{file_id}{ext}"


def _cache_path(project: str, file_id: str) -> Path:
    if not _ID_RE.match(file_id):
        raise ValueError("file id ไม่ถูกต้อง")
    return _files_dir(project) / f"{file_id}.pkl"


def ingest(
    project: str,
    file_id: str,
    ext: str,
    sheet: str | None = None,
    time_column: str | None = None,
) -> dict:
    """อ่านไฟล์ → cache. คืน metadata: timeColumn, columns (ตัวเลข), rows, start, end, sheets."""
    src = _source_path(project, file_id, ext)
    if not src.exists():
        raise ValueError("ไม่พบไฟล์ที่อัปโหลด")

    sheets: list[str] = []
    if ext == ".xlsx":
        sheets = pd.ExcelFile(src, engine="openpyxl").sheet_names
        raw = pd.read_excel(src, sheet_name=sheet or sheets[0], engine="openpyxl")
    else:
        raw = pd.read_csv(src)
    raw.columns = [str(c).strip() for c in raw.columns]
    if raw.empty or len(raw.columns) < 2:
        raise ValueError("ไฟล์ต้องมีอย่างน้อย 2 column (เวลา + ค่า)")

    tcol = time_column or raw.columns[0]
    if tcol not in raw.columns:
        raise ValueError(f"ไม่มี column เวลา: {tcol}")
    # column ตัวเลขห้ามเป็นเวลา (to_datetime จะตีความเลขเป็น epoch แล้วผ่านแบบผิดๆ)
    if pd.api.types.is_numeric_dtype(raw[tcol]):
        raise ValueError(f"column '{tcol}' เป็นตัวเลข ไม่ใช่เวลา — เลือก column เวลาใหม่")
    ts = pd.to_datetime(raw[tcol], errors="coerce")
    if ts.notna().mean() < 0.5:
        raise ValueError(f"column '{tcol}' อ่านเป็นเวลาไม่ได้ — เลือก column เวลาใหม่")

    df = pd.DataFrame({"timestamp": ts})
    for c in raw.columns:
        if c == tcol:
            continue
        v = pd.to_numeric(raw[c], errors="coerce")
        if v.notna().any():  # เก็บเฉพาะ column ที่มีตัวเลข
            df[c] = v
    df = (
        df.dropna(subset=["timestamp"])
        .drop_duplicates(subset="timestamp")
        .sort_values("timestamp")
        .reset_index(drop=True)
    )
    if df.empty or len(df.columns) < 2:
        raise ValueError("ไม่พบข้อมูลตัวเลขที่มีเวลา")

    df.to_pickle(_cache_path(project, file_id))  # cache key รวม mtime → ไฟล์ใหม่ถูกโหลดใหม่เอง
    step = df["timestamp"].diff().median()
    return {
        "timeColumn": tcol,
        "columns": [c for c in df.columns if c != "timestamp"],
        "allColumns": list(raw.columns),
        "rows": int(len(df)),
        "start": df["timestamp"].iloc[0].strftime("%Y-%m-%d %H:%M:%S"),
        "end": df["timestamp"].iloc[-1].strftime("%Y-%m-%d %H:%M:%S"),
        "stepSeconds": None if pd.isna(step) else int(step.total_seconds()),
        "sheet": (sheet or sheets[0]) if sheets else None,
        "sheets": sheets,
    }


@lru_cache(maxsize=8)
def _load_cached(path: str, mtime: float) -> pd.DataFrame:
    return pd.read_pickle(path)


def _load(project: str, file_id: str) -> pd.DataFrame:
    p = _cache_path(project, file_id)
    if not p.exists():
        raise ValueError(f"ไม่พบไฟล์ข้อมูล: {file_id} (อัปโหลดใหม่)")
    return _load_cached(str(p), p.stat().st_mtime)



def fetch(project: str, tags: list[str], start: str, end: str, interval: str) -> pd.DataFrame:
    """คืน DataFrame [timestamp, <tag>...] ชื่อ column = tag เต็ม ("file:<id>/<col>")."""
    if not project:
        raise ValueError("ต้องระบุ project สำหรับ tag จากไฟล์")
    by_file: dict[str, list[str]] = {}
    for t in tags:
        fid, col = split_tag(t)
        by_file.setdefault(fid, []).append(col)

    t0, t1 = pd.Timestamp(start), pd.Timestamp(end)
    freq = FREQ.get(interval)
    frames = []
    for fid, cols in by_file.items():
        df = _load(project, fid)
        missing = [c for c in cols if c not in df.columns]
        if missing:
            raise ValueError(f"ไฟล์ {fid} ไม่มี column: {', '.join(missing)}")
        part = df.loc[(df["timestamp"] >= t0) & (df["timestamp"] <= t1), ["timestamp", *cols]]
        part = part.set_index("timestamp")
        step = df["timestamp"].diff().median()
        # interval หยาบกว่าข้อมูล → ค่าแรกของแต่ละช่วง (≈ ค่า ณ ต้นช่วง)
        if freq and not pd.isna(step) and pd.Timedelta(freq) > step:
            part = part.resample(freq).first().dropna(how="all")
        part.columns = [f"{FILE_PREFIX}{fid}/{c}" for c in part.columns]
        frames.append(part)
    out = pd.concat(frames, axis=1).sort_index() if frames else pd.DataFrame()
    return out.reset_index().rename(columns={"index": "timestamp"})


def fetch_tags(project: str | None, tags: list[str], start: str, end: str, interval: str, pi_fetch):
    """เลือกแหล่งตาม tag: ไฟล์ทั้งหมด → ไฟล์, ไม่มีไฟล์ → pi_fetch(tags, start, end, interval), ปนกัน → error."""
    n_file = sum(is_file_tag(t) for t in tags)
    if n_file == 0:
        return pi_fetch(tags, start, end, interval)
    if n_file != len(tags):
        raise ValueError("ยังไม่รองรับการใช้ tag จากไฟล์ร่วมกับ PI tag ในคำขอเดียวกัน")
    return fetch(project or "", tags, start, end, interval)
