# Tasks Checklist

> ติ๊กระหว่างทำ อ้างอิง Phase จาก [roadmap-steps.md](roadmap-steps.md)

---

## Phase 0 — Project Setup
- [x] สร้างโครง monorepo (`web/`, `analysis-service/`, `docs/`)
- [x] Next.js init + TypeScript
- [x] TailwindCSS + ESLint + Prettier
- [x] FastAPI skeleton + `/health`
- [x] Next.js เรียก FastAPI `/health` ผ่าน
- [x] README dev setup

## Phase 1 — เชื่อม SQL Server + เลือก Tag
- [x] `base.py` connector interface
- [x] `sql_server.py` (pymssql, read-only)
- [x] API `/connections/test`
- [x] API `/connections/databases`
- [x] API `/connections/tables`
- [x] API `/connections/columns`
- [x] storage.ts + workspace API (save/load JSON)
- [x] UI: หน้ากรอก connection + ปุ่ม test (`/connect`)
- [x] UI: browse databases → tables → columns
- [ ] UI: เลือก time column + value column
- [ ] save tag/group ที่เลือกเป็นไฟล์ JSON

### PI Server connector (MI_CUBE PI Web API)
- [x] `pi_server.py` (POST + JSON, read-only)
- [x] API `/pi/test`
- [x] API `/pi/fetch` (multi-tag → DataFrame)
- [x] token เก็บใน `.env` (gitignored)
- [x] ทดสอบ fetch tag จริงได้ข้อมูลกลับ

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
- [x] ติดตั้ง ECharts + wrapper
- [x] `ChartCanvas.tsx` render line
- [x] dataZoom (scroll + slider)
- [x] Pan
- [x] Crosshair + tooltip หลาย series
- [x] Multi-series overlay
- [x] Legend toggle
- [x] `TimeRangeSelector` (1H/1D/1W/1M/custom)
- [x] `TagSearch`
- [x] `TagTreeSidebar`
- [x] `ChartWorkspace` state

## Phase 4 — Analysis Engine
- [x] `analysis/summary.py`
- [x] `analysis/sd.py`
- [x] `analysis/boxplot.py`
- [x] `analysis/kde.py`
- [x] `analysis/correlation.py`
- [x] `analysis/clustering.py` (k-means)
- [x] `analysis/histogram.py` (+ class mode: แบ่งตาม status tag)
- [x] `POST /analyze` endpoint
- [x] Next.js proxy `/api/analyze`
- [x] `AnalyticsPanel.tsx` tabs
- [x] Viz: summary table
- [x] Viz: SD line/band
- [x] Viz: boxplot
- [x] Viz: KDE curve
- [x] Viz: correlation heatmap
- [x] Viz: clustering scatter
- [x] Viz: histogram (overlay class + stats box)

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
- [ ] Save WorkspaceState → ไฟล์ JSON (`web/data/`)
- [ ] Load workspace
- [ ] Analysis template save/load (ไฟล์)
- [ ] Export CSV
- [ ] Export PNG

---

## Cross-cutting (ทำระหว่างทาง)
- [ ] Auth/RBAC (admin vs analyst) — ตัดสินใจ + implement
- [ ] Secret store สำหรับ credentials
- [ ] Error handling + loading states ทุกหน้า
- [ ] Timezone handling (UTC ↔ local)
- [ ] Unit tests (analysis functions)
- [ ] Logging ฝั่ง FastAPI

## Open Decisions (ต้องเคลียร์ก่อนถึง phase ที่เกี่ยว)
- [x] PI access method — ใช้ PI Web API (MI_CUBE REST)
- [x] Charting lib final — ใช้ ECharts (echarts-for-react)
- [ ] Auth solution (NextAuth?) — ก่อน Phase 1 จบ
- [ ] Secret store — ก่อน Phase 1 (test connection)
- [ ] Deployment target — ก่อน production

---

## Recent Work (2026-09-29)

### Features
- [x] Class-based histogram — แบ่งค่า kappa ตาม status tag (0-4) เป็น overlay หลาย class
  - `histogram.py`: `_histogram_by_class()` ใช้ shared bin edges
  - `analyze.py`: รับ `valueColumn` + `classColumn`
  - `HistogramCanvas.tsx`: overlay bars + stats box (n/mean/median/sd ต่อ class) + axis controls

### Bug Fixes
- [x] `x.toFixed is not a function` — ค่าจาก PI เป็น string ทำให้ `.toFixed()` พัง
  - `page.tsx` `computeStats`: แปลง `Number(x)` ก่อนคำนวณ
  - `ChartCanvas.tsx`: axisLabel formatter + series data แปลงเป็น number
- [x] เลือก tag แล้วกราฟไม่ขึ้น + ปุ่ม refresh หาย — ปุ่ม Chart ติดเงื่อนไข `if (!visible.chart)`
  - `page.tsx`: ปุ่ม Chart เรียก `refreshChart()` เสมอ (ดึงข้อมูลทุกครั้ง)

### Data Notes
- `PULP-LINE2-PRESS1-ACTIVE-DIGESTER` **ไม่ใช่ผลรวม (SUM)** ของ 4 sub-tag `PPPC_DP_Cooking.B1-B4`
  - เป็น "batch ไหนกำลัง active" (ค่า 1-4 = digester ตัวที่ 1-4, 0 = ช่วงเปลี่ยนถ่าน)
  - เทียบทีละ timestamp: ROLLUP == MAX 83/97, == SUM 44/97 (ต่างเพราะ PI interpolate)
  - tag รวมสร้างใหม่ (count 633 < sub-tags 745 ต่อเดือน)
