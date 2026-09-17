# Workspace UX (ยืม pattern จาก TradingView — แต่ยืดหยุ่นกว่า)

เป้าหมาย: ไม่ได้เลียนแบบ TradingView เป๊ะๆ แค่ **ยืม UX pattern ที่ใช้งานดี** (chart เป็นศูนย์กลาง, เลือก/ซ้อน series ง่าย, zoom/pan, save workspace)
แต่ platform เรา **หลากหลายกว่า** เพราะเน้นงาน analysis หลายแบบ (box plot, KDE, correlation, clustering) ที่ chart การเงินทั่วไปไม่มี

**หลักคิด:** เอาความ "ลื่น + intuitive" ของ TradingView + ความ "หลากหลายของ visualization/analysis" ของเครื่องมือ data science

---

## 1. Feature (จัดลำดับความสำคัญ)

### Must-have (Phase 3) — พื้นฐานที่ทำให้ chart ใช้งานลื่น
- [ ] **Interactive time-series chart** — line/area
- [ ] **Zoom & Pan** — scroll zoom, drag pan (ECharts `dataZoom` inside + slider)
- [ ] **Crosshair + tooltip** — ลากเมาส์เห็นค่าทุก series ณ เวลานั้น
- [ ] **Multi-series overlay** — ซ้อนหลาย tag บน chart เดียว
- [ ] **Legend toggle** — คลิกซ่อน/แสดง series
- [ ] **Time range selector** — ปุ่ม preset + custom
- [ ] **Tag search** — พิมพ์ค้น tag แล้วเพิ่มเข้า chart

### Should-have (Phase 4-6) — ความหลากหลายที่เหนือกว่า TradingView
- [ ] **หลาย chart type** — line, area, scatter, boxplot, histogram, heatmap (เลือกได้)
- [ ] **Multiple panes** — chart หลัก + sub-pane (SD / indicator / analysis)
- [ ] **Flexible layout** — 1 chart, 2x2 grid, tabs (ไม่ fix แบบ TradingView)
- [ ] **Indicators / transforms** — moving average, bands, normalize, diff
- [ ] **Save / Load workspace** — เก็บ series + range + layout + analysis config
- [ ] **Compare mode** — normalize หลาย tag (% change หรือ z-score) เทียบกัน
- [ ] **Second Y-axis** — tag ต่าง unit อยู่ chart เดียวกันได้

### Nice-to-have (later)
- [ ] Dark/Light theme toggle
- [ ] Full-screen chart
- [ ] Snapshot / export PNG / CSV
- [ ] Drawing tools เบื้องต้น (horizontal line, marker)
- [ ] Real-time update (streaming) — เมื่อมี ingestion

---

## 2. Layout (UI structure)

```text
┌────────────────────────────────────────────────────────────┐
│  TopBar: [Tag search]  [Time range: 1H 1D 1W 1M ▾]  [Save]  │
├───────────┬────────────────────────────────────────────────┤
│           │  Main Chart Pane (multi-series, crosshair)       │
│  Left     │  ────────────────────────────────────────────   │
│  Sidebar  │  Sub Pane (SD / indicator)                       │
│  (Tag/    │  ────────────────────────────────────────────   │
│   Group   │  dataZoom slider ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁          │
│   tree)   ├────────────────────────────────────────────────┤
│           │  Bottom: Analysis panel (tabs)                   │
│           │  [Summary][Boxplot][KDE][Correlation][Cluster]   │
└───────────┴────────────────────────────────────────────────┘
```

- **Left sidebar**: tree ของ Group -> Tag, drag/click เพื่อเพิ่มเข้า chart
- **TopBar**: search tag, เลือกช่วงเวลา, save workspace
- **Main pane**: chart หลัก
- **Sub pane**: indicator / SD (แชร์ x-axis กับ main)
- **Bottom panel**: analysis result เป็น tabs

---

## 3. Component Breakdown (Next.js)

```text
web/components/chart/
├─ ChartWorkspace.tsx      # container, จัดการ state ของ series + range
├─ ChartCanvas.tsx         # ECharts wrapper (dataZoom, crosshair, panes)
├─ TagSearch.tsx           # ช่องค้น + เพิ่ม tag
├─ TagTreeSidebar.tsx      # tree group -> tag
├─ TimeRangeSelector.tsx   # 1H/1D/1W/1M/custom
├─ SeriesLegend.tsx        # toggle series
├─ IndicatorMenu.tsx       # เพิ่ม indicator
└─ AnalysisPanel.tsx       # tabs: summary/boxplot/kde/correlation/cluster
```

State หลัก (client):
```ts
type WorkspaceState = {
  layout: "single" | "grid-2x2" | "tabs";        // ยืดหยุ่นกว่า TradingView
  panels: {
    id: string;
    chartType: "line" | "area" | "scatter" | "boxplot" | "histogram" | "heatmap";
    series: { tagId: string; color: string; visible: boolean; yAxis: 0 | 1 }[];
    analysis?: AnalysisConfig;                    // ผูก analysis เข้ากับ panel ได้
  }[];
  timeRange: { start: string; end: string } | { preset: string };
  resample: { interval: string; method: "mean" | "last" | "interpolated" };
  filters: FilterConfig[];
  indicators: IndicatorConfig[];
};
```

> WorkspaceState นี้ = สิ่งที่ save ลง `Workspace.layoutJson`
> จุดต่างจาก TradingView: **panel เลือก chartType ได้อิสระ + layout หลายแบบ + ผูก analysis ต่อ panel**

---

## 4. Charting library — ECharts vs Plotly

| หัวข้อ | ECharts | Plotly |
|---|---|---|
| Zoom/pan (dataZoom) | ดีมาก, ลื่น | ดี |
| Multi-pane axis link | ทำได้ (grid + axisPointer link) | ทำได้ |
| Performance จุดเยอะ | ดี (canvas, progressive) | พอใช้ |
| Bundle size | เล็กกว่าถ้า tree-shake | ใหญ่กว่า |
| React wrapper | echarts-for-react | react-plotly.js |

**แนะนำ: ECharts** — เพราะเราต้องการ **chart หลากหลาย** (line, scatter, boxplot, histogram, heatmap) ในไลบรารีเดียว + dataZoom/axisPointer/grid ดี เหมาะทั้ง trend และ analysis

> `lightweight-charts` ของ TradingView เก่งเฉพาะ financial-style แต่ไม่มี boxplot/heatmap/scatter จึงไม่เหมาะกับความหลากหลายที่เราต้องการ

---

## 5. Mapping: Analysis -> Visualization

| Analysis | Chart |
|---|---|
| Summary stats | table |
| SD | line ใน sub-pane / band รอบ mean |
| Box plot | ECharts boxplot |
| KDE | density curve (line/area) |
| Correlation matrix | heatmap |
| Clustering | scatter (สีตาม cluster) |

---

## 6. ความหลากหลาย (จุดที่เหนือกว่า TradingView)

### 6.1 Chart types ที่เลือกได้ต่อ panel
| Type | ใช้เมื่อ |
|---|---|
| Line / Area | trend ตามเวลา (default) |
| Scatter | หา relationship ระหว่าง 2 tag / cluster result |
| Box plot | distribution เทียบหลาย tag |
| Histogram | การกระจายของค่า tag เดียว |
| Heatmap | correlation matrix / density ตามเวลา |

### 6.2 Layout modes (ยืดหยุ่นกว่า)
| Mode | ลักษณะ |
|---|---|
| Single | chart เดียวเต็มจอ (โฟกัส) |
| Grid 2x2 | เทียบ 4 มุมมองพร้อมกัน |
| Tabs | หลาย view สลับแท็บ (ประหยัดพื้นที่) |
| Main + sub-pane | chart หลัก + indicator/analysis ด้านล่าง (แบบ TradingView) |

### 6.3 View / Compare modes
- **Overlay** — ซ้อนทุก series แกนเดียว (ค่าใกล้กัน)
- **Dual Y-axis** — tag ต่าง unit บน chart เดียว
- **Normalize** — ปรับเป็น % change หรือ z-score เพื่อเทียบ trend
- **Stacked panes** — แต่ละ tag แยก pane แชร์แกนเวลา

### 6.4 หลักการออกแบบให้ยืดหยุ่น
- ทุก panel เป็น component เดียวกัน รับ prop `chartType` → เพิ่ม type ใหม่ได้ง่าย
- `WorkspaceState` เก็บ config ครบ → save/restore ได้ทุก layout
- Analysis ผูกกับ panel ได้ (ไม่ fix อยู่ bottom panel อย่างเดียว)

---

## 7. เทียบกับ TradingView (สรุปสั้น)

| ด้าน | TradingView | Platform เรา |
|---|---|---|
| แหล่งข้อมูล | ตลาดการเงิน | SQL / PI (industrial tags) |
| Chart type | เน้น candlestick/line | line/scatter/boxplot/histogram/heatmap |
| Layout | ค่อนข้าง fix | single/grid/tabs ยืดหยุ่น |
| Analysis | technical indicators | stats/KDE/correlation/clustering |
| จุดเด่นที่ยืมมา | zoom/pan, crosshair, save layout, ค้น symbol | (ยืมทั้งหมด) |
