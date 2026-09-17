# Analytics Platform

เว็บแพลตฟอร์มจัดการ Tag จากหลายแหล่ง (SQL, PI Server) แบบ read-only พร้อม analysis workspace
ดูภาพรวมที่ [summary.md](summary.md) และเอกสารใน [docs/](docs/).

## โครงสร้าง

```
analytics platform/
├─ web/               # Next.js + TypeScript (frontend + orchestration API) + Prisma
├─ analysis-service/  # Python FastAPI (connector + analysis)
├─ docs/              # เอกสารวางแผน
└─ docker-compose.yml # postgres + web + analysis-service
```

## Dev setup (local, ไม่ใช้ Docker)

### 1. Postgres
รัน Postgres ด้วย Docker (แนะนำ) หรือ local install:
```powershell
docker compose up -d postgres
```
ถ้ายังไม่มี Docker: ติดตั้ง PostgreSQL แล้วสร้าง DB `analytics_platform`
แล้วตั้ง `DATABASE_URL` ใน `web/.env`

### 2. Analysis service (FastAPI)
```powershell
cd analysis-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
เช็ค: http://localhost:8000/health

### 3. Web (Next.js)
```powershell
cd web
npm install
npx prisma generate
npm run dev
```
เปิด: http://localhost:3000 → หน้าแรกจะแสดงสถานะ analysis-service

## Dev setup (Docker — เมื่อพร้อม)
```powershell
docker compose up --build
```

## Ports
| Service | Port |
|---|---|
| web (Next.js) | 3000 |
| analysis-service (FastAPI) | 8000 |
| postgres | 5432 |
