# Architecture

## 1. High-Level

```mermaid
flowchart TB
    subgraph Client["Browser"]
        UI["Next.js UI + ECharts (interactive workspace)"]
    end

    subgraph Web["Next.js App (TypeScript)"]
        API["API Routes / Server Actions (orchestration)"]
        Prisma["Prisma ORM"]
    end

    subgraph PG["PostgreSQL (Metadata only)"]
        META["users, tags, groups, data_sources,\nmappings, templates, workspaces, audit_log"]
    end

    subgraph Py["Python FastAPI (Data + Analysis Service)"]
        CONN["Connector Layer (SQL / PI adapters)"]
        PIPE["Pipeline: normalize -> resample -> filter"]
        ANALYSIS["Analysis Engine (pandas/numpy/scipy/sklearn)"]
    end

    subgraph Sources["External Sources (read-only)"]
        SQL["SQL Server / DB"]
        PISVR["PI Server"]
    end

    UI --> API
    API --> Prisma --> META
    API -->|fetch+analyze| CONN
    CONN --> SQL
    CONN --> PISVR
    CONN --> PIPE --> ANALYSIS
    ANALYSIS -->|JSON result| API --> UI
```

**Key decisions**

- Connector Layer อยู่ฝั่ง **FastAPI** → `fetch → normalize → resample → filter → analyze` ที่เดียว
- Next.js = UI + CRUD metadata + orchestration
- V1: ไม่ทำ ingestion, ไม่เก็บ time-series ซ้ำ, ดึงตรงจาก source

---

## 2. Data Flow (V1)

```text
User
 -> Next.js UI (เลือก tag, ช่วงเวลา, resample, analysis, filter config)
 -> Next.js API (validate + โหลด tag metadata)
 -> FastAPI /data หรือ /analyze  (ส่ง tag refs + params)
     -> Connector -> SQL / PI (read-only, parameterized)
     -> Normalize -> format กลาง
     -> Resample
     -> Filter / Clean
     -> Analysis (ถ้าเป็น /analyze)
 -> Return JSON
 -> UI Render Chart / Table / Export
```

---

## 3. Data Model (Metadata)

```mermaid

erDiagram
    DataSource ||--o{ Tag : has
    Tag ||--o{ TagGroupMember : in
    Group ||--o{ TagGroupMember : contains
    Group ||--o{ Group : parent
    User ||--o{ AuditLog : performs
    User ||--o{ Workspace : owns

    DataSource {
        uuid id PK
        string name
        string type "SQL | PI"
        string description
        string connectionReference "secret ref, NOT plaintext"
        boolean active
    }
    Tag {
        uuid id PK
        string tagName
        string displayName
        string description
        uuid sourceId FK
        string sourceTagName
        string dataType
        string unit
        string timezone
        boolean active
    }
    Group {
        uuid id PK
        string name
        string code
        string description
        uuid parentId FK
    }
    TagGroupMember {
        uuid tagId FK
        uuid groupId FK
    }
    AnalysisTemplate {
        uuid id PK
        string name
        string analysisType
        json configJson
    }
    Workspace {
        uuid id PK
        uuid userId FK
        string name
        json layoutJson "chart panes, series, indicators"
    }
    AuditLog {
        uuid id PK
        uuid userId FK
        string action
        json detail
        datetime createdAt
    }
```

> `Workspace` = โต๊ะทำงานแบบ TradingView (บันทึก layout, series, indicators, time range)

---

## 4. Standard Data Format (Connector output)

Single point:

```json
{
  "tagId": "tag-001",
  "tagName": "furnace_01_temperature",
  "timestamp": "2026-09-17T08:00:00Z",
  "value": 82.5,
  "quality": "GOOD",
  "unit": "C"
}
```

Columnar (แนะนำสำหรับ payload ใหญ่ / chart):

```json
{
  "tagId": "tag-001",
  "tagName": "furnace_01_temperature",
  "unit": "C",
  "timestamps": ["2026-09-17T08:00:00Z", "2026-09-17T08:01:00Z"],
  "values": [82.5, 82.7],
  "qualities": ["GOOD", "GOOD"]
}
```

---

## 5. API Contract (Next.js <-> FastAPI)

### POST /data — ดึง time-series สำหรับ chart

```jsonc
// Request
{
  "tags": [
    { "tagId": "tag-001", "source": { "type": "SQL", "connectionRef": "sql-prod-1", "sourceTagName": "FURN01_TEMP" } }
  ],
  "timeRange": { "start": "2026-09-01T00:00:00Z", "end": "2026-09-17T00:00:00Z" },
  "resample": { "interval": "5m", "method": "mean" },
  "filters": [
    { "type": "quality", "keep": ["GOOD"] },
    { "type": "range", "min": 0, "max": 1500 }
  ]
}

// Response (columnar)
{
  "status": "ok",
  "series": [
    { "tagId": "tag-001", "unit": "C", "timestamps": [...], "values": [...] }
  ],
  "meta": { "rowsBefore": 24000, "rowsAfterFilter": 23110 }
}
```

### POST /analyze — วิเคราะห์

```jsonc
{
  "tags": [ /* เหมือน /data */ ],
  "timeRange": { ... },
  "resample": { ... },
  "filters": [ ... ],
  "analysis": { "type": "correlation" }  // summary|sd|boxplot|kde|correlation|clustering
}
```

---

## 6. Filter / Cleaning (config-driven)

| Filter   | Config                | ใช้เมื่อ                                |
| -------- | --------------------- | ----------------------------------------------- |
| quality  | `keep: ["GOOD"]`    | ตัด bad quality                              |
| range    | `min, max`          | ตัดค่าเพี้ยน / เครื่องปิด |
| flatline | `window, tolerance` | ค่าค้างนิ่งผิดปกติ            |
| zscore   | `threshold`         | outlier                                         |
| iqr      | `factor`            | outlier แบบ robust                           |

---

## 7. Security (ต้อง design ตั้งแต่ต้น)

| หัวข้อ  | แนวทาง                                                                         |
| ------------- | ------------------------------------------------------------------------------------ |
| Credentials   | เก็บแค่`connectionReference`, resolve จาก secret store / encrypt at rest |
| SQL injection | parameterized query เสมอ; user เลือก tag/time เท่านั้น              |
| Read-only     | ใช้ account สิทธิ์ read/SELECT อย่างเดียว                         |
| Timezone      | เก็บ/ส่ง UTC (ISO 8601), แปลง local ที่ UI                             |
| Audit         | log ทุก query/analysis                                                            |

---

## 8. Open Decisions (ต้องตัดสินใจ)

1. **PI access** — PI Web API (REST) vs OLEDB/SQL → ออกแบบ PI adapter เป็น interface เดียว, เลือก backend ทีหลัง
2. **Auth/RBAC** — NextAuth? role: admin (จัดการ source) vs analyst (วิเคราะห์)
3. **Secret store** — Vault / cloud secret manager / encrypted column
4. **Deployment** — Docker Compose (dev) → managed (prod)?
5. **Charting lib** — ECharts (แนะนำ, dataZoom ดี) vs Plotly
