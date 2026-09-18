# Analytics Platform

เว็บแพลตฟอร์มดู/วิเคราะห์ข้อมูลจาก SQL Server (read-only) พร้อม analysis workspace
ดูภาพรวมที่ [summary.md](summary.md) และเอกสารใน [docs/](docs/).

## โครงสร้าง

```
analytics platform/
├─ web/               # Next.js + TypeScript (frontend + orchestration API)
│                     # metadata (layout/group) เก็บเป็นไฟล์ JSON ที่ web/data/
├─ analysis-service/  # Python FastAPI (SQL Server connector + analysis)
└─ docs/              # เอกสารวางแผน
```

> **ไม่มี database ของเราเอง** — time-series ดึงจาก SQL Server ต้นทาง (read-only),
> metadata เก็บเป็นไฟล์ JSON ในเครื่อง

## Dev setup (local)

### 1. Analysis service (FastAPI)
```powershell
cd analysis-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
เช็ค: http://localhost:8000/health

### 2. Web (Next.js)
```powershell
cd web
npm install
npm run dev
```
เปิด: http://localhost:3000 → หน้าแรกจะแสดงสถานะ analysis-service

## Ports
| Service | Port |
|---|---|
| web (Next.js) | 3000 |
| analysis-service (FastAPI) | 8000 |
