# Tasks Checklist

> ติ๊กระหว่างทำ อ้างอิง Phase จาก [roadmap-steps.md](roadmap-steps.md)

---

## Phase 0 — Project Setup
- [ ] สร้างโครง monorepo (`web/`, `analysis-service/`, `docs/`)
- [ ] `docker-compose.yml` (postgres + web + analysis-service)
- [ ] Next.js init + TypeScript
- [ ] TailwindCSS + ESLint + Prettier
- [ ] Prisma init + เชื่อม postgres
- [ ] Prisma migrate เปล่า สำเร็จ
- [ ] FastAPI skeleton + `/health`
- [ ] Next.js เรียก FastAPI `/health` ผ่าน
- [ ] README dev setup

## Phase 1 — Metadata CRUD
- [ ] Prisma schema: DataSource
- [ ] Prisma schema: Tag
- [ ] Prisma schema: Group + parentId
- [ ] Prisma schema: TagGroupMember
- [ ] Prisma schema: User, AuditLog
- [ ] Migrate + seed ตัวอย่าง
- [ ] API CRUD: DataSource
- [ ] API CRUD: Tag
- [ ] API CRUD: Group
- [ ] UI list + form: DataSource
- [ ] UI list + form: Tag
- [ ] UI list + form: Group
- [ ] UI: Tag ↔ Group mapping
- [ ] Test connection (FastAPI `/connections/test`)
- [ ] Credential เก็บเป็น reference เท่านั้น

## Phase 2 — Connector + Data Fetch
- [ ] `BaseConnector` interface
- [ ] `sql_adapter.py` (parameterized, read-only)
- [ ] `pi_adapter.py` (interface, backend เลือกทีหลัง)
- [ ] Normalize → columnar format
- [ ] Resample (mean/last/interpolated)
- [ ] `POST /data` endpoint
- [ ] Next.js proxy `/api/data`
- [ ] ทดสอบดึง 1 tag ได้ JSON กลับ

## Phase 3 — TradingView Chart
- [ ] ติดตั้ง ECharts + wrapper
- [ ] `ChartCanvas.tsx` render line
- [ ] dataZoom (scroll + slider)
- [ ] Pan
- [ ] Crosshair + tooltip หลาย series
- [ ] Multi-series overlay
- [ ] Legend toggle
- [ ] `TimeRangeSelector` (1H/1D/1W/1M/custom)
- [ ] `TagSearch`
- [ ] `TagTreeSidebar`
- [ ] `ChartWorkspace` state

## Phase 4 — Analysis Engine
- [ ] `analysis/summary.py`
- [ ] `analysis/sd.py`
- [ ] `analysis/boxplot.py`
- [ ] `analysis/kde.py`
- [ ] `analysis/correlation.py`
- [ ] `analysis/clustering.py` (k-means)
- [ ] `POST /analyze` endpoint
- [ ] Next.js proxy `/api/analyze`
- [ ] `AnalysisPanel.tsx` tabs
- [ ] Viz: summary table
- [ ] Viz: SD line/band
- [ ] Viz: boxplot
- [ ] Viz: KDE curve
- [ ] Viz: correlation heatmap
- [ ] Viz: clustering scatter

## Phase 5 — Filter / Cleaning
- [ ] `filter.py`: quality
- [ ] `filter.py`: range
- [ ] `filter.py`: flatline
- [ ] `filter.py`: zscore
- [ ] `filter.py`: iqr
- [ ] รับ `filters[]` ใน `/data` และ `/analyze`
- [ ] คืน meta rowsBefore/rowsAfterFilter
- [ ] UI filter config panel

## Phase 6 — Workspace & Templates
- [ ] Prisma: Workspace
- [ ] Prisma: AnalysisTemplate
- [ ] Save WorkspaceState → layoutJson
- [ ] Load workspace
- [ ] Analysis template save/load
- [ ] Export CSV
- [ ] Export PNG
- [ ] Audit log ทุก query/analysis

---

## Cross-cutting (ทำระหว่างทาง)
- [ ] Auth/RBAC (admin vs analyst) — ตัดสินใจ + implement
- [ ] Secret store สำหรับ credentials
- [ ] Error handling + loading states ทุกหน้า
- [ ] Timezone handling (UTC ↔ local)
- [ ] Unit tests (analysis functions)
- [ ] Logging ฝั่ง FastAPI

## Open Decisions (ต้องเคลียร์ก่อนถึง phase ที่เกี่ยว)
- [ ] PI access method (PI Web API vs OLEDB) — ก่อน Phase 2
- [ ] Charting lib final (ECharts vs Plotly) — ก่อน Phase 3
- [ ] Auth solution (NextAuth?) — ก่อน Phase 1 จบ
- [ ] Secret store — ก่อน Phase 1 (test connection)
- [ ] Deployment target — ก่อน production
