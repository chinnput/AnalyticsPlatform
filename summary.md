# Analytics Platform — สรุปโปรเจกต์

> เว็บแพลตฟอร์มจัดการ Tag จากหลายแหล่ง (SQL, PI Server) แบบ **read-only** พร้อม analysis workspace
> UX **ยืม pattern ที่ดีจาก TradingView** (chart เป็นศูนย์กลาง, ซ้อน series, zoom/pan, save layout)
> แต่ **หลากหลายกว่า** — chart หลายแบบ + analysis (stats/KDE/correlation/clustering)

---

## 1. เป้าหมาย (What we're building)

แพลตฟอร์มที่ให้ผู้ใช้:
- เพิ่ม/แก้ไข Tag (metadata) จากหน้าบ้าน โดย **ไม่ยุ่งกับข้อมูลต้นทาง** (อ่านอย่างเดียว)
- ดึงข้อมูล time-series ตามช่วงเวลา จาก SQL / PI
- ดู chart แบบ interactive (แบบ TradingView): zoom, pan, crosshair, ซ้อนหลาย tag
- วิเคราะห์: Summary stats, SD, Box plot, KDE, Correlation matrix, Clustering
- Filter / clean ข้อมูลก่อนวิเคราะห์ (config-driven)
- บันทึก workspace / layout / template ไว้ใช้ซ้ำ

---

## 2. Tech Stack (สรุป)

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend + Main App | **Next.js + TypeScript** |
| Metadata storage | **ไฟล์ JSON ในเครื่อง** (`web/data/`) — ไม่มี DB ของเราเอง |
| Data + Analysis Service | **Python FastAPI** (รวม Connector Layer) |
| Connector | Adapter pattern: **SQL Server** (pymssql), PI adapter (ภายหลัง) |
| Analysis libs | pandas, numpy, scipy, scikit-learn |
| Charting | **ECharts** หรือ **Plotly** (แนะนำ ECharts สำหรับ TradingView-like) |

**Key decisions:**
- Connector Layer อยู่ฝั่ง **FastAPI** → pipeline `fetch → normalize → resample → filter → analyze` อยู่ที่เดียว
- **ไม่มี database ของเราเอง** — ข้อมูล time-series ดึงจาก source (SQL Server) ที่มีอยู่แล้ว, metadata (layout/group) เก็บเป็นไฟล์ JSON ในเครื่อง (เหมาะกับใช้คนเดียว, เพิ่ม DB ทีหลังได้)

---

## 3. เอกสารทั้งหมด (อ่านตามลำดับ)

1. [docs/architecture.md](docs/architecture.md) — โครงสร้างระบบ, data model, API contract
2. [docs/tradingview-ux.md](docs/tradingview-ux.md) — feature ที่เลียนแบบ TradingView + UI structure
3. [docs/roadmap-steps.md](docs/roadmap-steps.md) — แผนลงมือทำเป็น step (Phase 0 → 6)
4. [docs/tasks-checklist.md](docs/tasks-checklist.md) — checklist ละเอียด ติ๊กได้ระหว่างทำ

---

## 4. Roadmap แบบย่อ (Phases)

| Phase | ชื่อ | ผลลัพธ์ |
|---|---|---|
| **0** | Project Setup | monorepo, Next.js + FastAPI skeleton รันได้ |
| **1** | เชื่อม SQL Server | test connection, list databases/tables/columns, เลือก tag |
| **2** | Connector + Data Fetch | ดึง time-series จาก SQL/PI → format กลาง |
| **3** | TradingView Chart | chart interactive, multi-series, zoom/pan, crosshair |
| **4** | Analysis Engine | summary, SD, boxplot, KDE, correlation, clustering |
| **5** | Filter / Cleaning | pipeline config-driven (quality/range/flatline/outlier) |
| **6** | Workspace & Templates | save layout, template, export, audit log |

รายละเอียดแต่ละ step → [docs/roadmap-steps.md](docs/roadmap-steps.md)

---

## 5. โครงสร้าง Folder เป้าหมาย (เมื่อ scaffold)

```text
analytics-platform/
├─ summary.md                 # ไฟล์นี้
├─ docs/                      # เอกสารวางแผน
│  ├─ architecture.md
│  ├─ tradingview-ux.md
│  ├─ roadmap-steps.md
│  └─ tasks-checklist.md
├─ web/                       # Next.js + TypeScript (frontend + orchestration API)
│  ├─ app/
│  │  └─ api/workspace/       # save/load layout เป็นไฟล์ JSON
│  ├─ components/
│  │  └─ chart/               # TradingView-like chart components
│  ├─ lib/                    # storage.ts (JSON files), types.ts, config.ts
│  ├─ data/                   # metadata JSON (gitignored)
│  └─ package.json
└─ analysis-service/          # Python FastAPI (connector + analysis)
   ├─ app/
   │  ├─ connectors/          # base.py, sql_server.py, (pi later)
   │  ├─ pipeline/            # normalize, resample, filter
   │  ├─ analysis/            # stats, correlation, clustering, kde
   │  ├─ api/                 # routes (health, connections)
   │  └─ main.py
   └─ requirements.txt
```

---

## 6. Next actions

- [ ] อ่าน [docs/roadmap-steps.md](docs/roadmap-steps.md) แล้วยืนยัน scope Phase 0–1
- [ ] ตัดสินใจ open questions ใน [docs/architecture.md](docs/architecture.md) (PI access, Auth, Secret store)
- [ ] เริ่ม scaffold Phase 0
