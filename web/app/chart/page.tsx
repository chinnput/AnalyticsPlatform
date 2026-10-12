"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChartCanvas, {
  ChartData,
  DrawMode,
  Annotation,
  bandsFromClasses,
} from "@/components/ChartCanvas";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import ClassDefEditor from "@/components/ClassDefEditor";
import { CLASS_PRESETS } from "@/lib/classPresets";
import { classLabels } from "@/lib/types";
import { displayTag, fileIdOfTag } from "@/lib/types";
import type {
  ProjectFile,
  ChartClassUsage,
  ClassDef,
  PanelSettings,
  Project,
  ProjectSettings,
  RangePreset,
  SavedTag,
} from "@/lib/types";

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function rangeFromPreset(preset: RangePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  if (preset === "1D") start.setDate(end.getDate() - 1);
  else if (preset === "1W") start.setDate(end.getDate() - 7);
  else if (preset === "1M") start.setMonth(end.getMonth() - 1);
  return { start: fmt(start), end: fmt(end) };
}

const UNGROUPED = "Ungrouped";

type Mode = "chart" | "analytics";

interface TagStat {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  std: number | null;
}

function computeStats(values: (number | null)[]): TagStat {
  const v = values
    .map((x) => (x == null ? NaN : Number(x)))
    .filter((x) => !Number.isNaN(x));
  const n = v.length;
  if (n === 0)
    return { count: 0, min: null, max: null, mean: null, median: null, std: null };
  const sorted = [...v].sort((a, b) => a - b);
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const mid = Math.floor(n / 2);
  const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const std = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return { count: n, min: sorted[0], max: sorted[n - 1], mean, median, std };
}

const fmtNum = (x: number | null) =>
  x == null ? "-" : Math.abs(x) >= 1000 || Number.isInteger(x) ? x.toFixed(0) : x.toFixed(2);

// useSearchParams ต้องอยู่ใน Suspense (Next.js app router)
export default function ChartRoute() {
  return (
    <Suspense>
      <ChartGate />
    </Suspense>
  );
}

// ต้องเลือก project ก่อน — ไม่มี project = ไม่มี tag ให้ใช้
function ChartGate() {
  const projectId = useSearchParams().get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setProject(await res.json());
      })
      .catch(() => setError("ไม่พบ project นี้"));
  }, [projectId]);

  if (!projectId || error) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-3 bg-black text-[12px] text-neutral-400">
        <p>{error || "ยังไม่ได้เลือก project"}</p>
        <a
          href="/projects"
          className="rounded bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-500"
        >
          ไปหน้า Projects →
        </a>
      </main>
    );
  }
  if (!project) {
    return <main className="h-screen bg-black" />;
  }
  return <ChartPage key={project.id} project={project} />;
}

function ChartPage({ project }: { project: Project }) {
  const s0 = project.settings ?? {};
  const [activeTags, setActiveTags] = useState<string[]>(s0.activeTags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [preset, setPreset] = useState<RangePreset>(s0.preset ?? "1D");
  const [customStart, setCustomStart] = useState(s0.customStart ?? "");
  const [customEnd, setCustomEnd] = useState(s0.customEnd ?? "");
  const [interval, setInterval] = useState(s0.interval ?? "1h");
  const [data, setData] = useState<ChartData | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<SavedTag[]>(project.tags ?? []);
  const [visible, setVisible] = useState({ chart: false });
  const [mode, setMode] = useState<Mode>(s0.mode ?? "chart");
  const [panelCount, setPanelCount] = useState(s0.panelCount ?? 1);
  const [panels, setPanels] = useState<PanelSettings[]>(s0.panels ?? []);
  const [newGroup, setNewGroup] = useState("");
  const [groups, setGroups] = useState<string[]>(project.groups ?? []);
  const [files, setFiles] = useState<ProjectFile[]>(project.files ?? []);
  const [uploading, setUploading] = useState(false);
  const [classDefs, setClassDefs] = useState<ClassDef[]>(project.classDefs ?? []);
  const [chartClass, setChartClass] = useState<ChartClassUsage | null>(
    s0.chartClass ?? null,
  );
  const [chartClasses, setChartClasses] = useState<(string | null)[] | null>(null);
  const [showClassEditor, setShowClassEditor] = useState(false);
  const chartClassDef = chartClass
    ? classDefs.find((d) => d.id === chartClass.defId) ?? null
    : null;
  const classPresets = CLASS_PRESETS.filter(
    (p) => !classDefs.some((d) => d.id === p.id),
  );
  const [rightOpen, setRightOpen] = useState(true);
  const [rightWidth, setRightWidth] = useState(256);
  const [iqrOn, setIqrOn] = useState(false);
  const iqrK = 1.5; // ค่ามาตรฐาน IQR (auto)
  const [iqrSuggest, setIqrSuggest] = useState<
    { tag: string; total: number; outliers: number }[] | null
  >(null);
  const [scaleMode, setScaleMode] = useState<"single" | "multiple" | "range">(
    s0.scaleMode ?? "multiple",
  );
  const [scaleMin, setScaleMin] = useState("");
  const [scaleMax, setScaleMax] = useState("");
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const patchProject = (patch: Partial<Project>) =>
    fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => setMessage("บันทึก project ไม่สำเร็จ"));

  // บันทึกค่าที่ตั้งไว้อัตโนมัติเมื่อเปลี่ยน (debounce) — ข้ามรอบแรกที่เพิ่งโหลด
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const settings: ProjectSettings = {
      preset,
      customStart,
      customEnd,
      interval,
      activeTags,
      mode,
      scaleMode,
      panelCount,
      panels,
      chartClass,
    };
    const t = setTimeout(() => patchProject({ settings }), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customStart, customEnd, interval, activeTags, mode, scaleMode, panelCount, panels, chartClass]);

  // เปลี่ยน class บน chart → ดึงใหม่ทันทีถ้ากราฟเปิดอยู่
  const chartClassFirst = useRef(true);
  useEffect(() => {
    if (chartClassFirst.current) {
      chartClassFirst.current = false;
      return;
    }
    if (visible.chart) refreshChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartClass, chartClassDef]);

  // บันทึกจาก Class Settings — definition ที่ถูกลบ: chart กลับเป็น off
  function saveClassDefs(next: ClassDef[]) {
    setClassDefs(next);
    patchProject({ classDefs: next });
    if (chartClass && !next.some((d) => d.id === chartClass.defId)) setChartClass(null);
  }

  const usedClassIds = [
    ...panels.map((p) => p?.classUse?.defId),
    chartClass?.defId,
  ].filter((x): x is string => !!x);

  // เลือก definition ให้ chart: preset จะถูก copy เข้า project ก่อน · เริ่มที่ shade ทุก class
  function selectChartClass(id: string) {
    if (!id) return setChartClass(null);
    const def =
      classDefs.find((d) => d.id === id) ?? classPresets.find((p) => p.id === id);
    if (!def) return;
    addClassDef(def);
    setChartClass({ defId: id, mode: "shade", include: classLabels(def) });
  }

  function toggleChartClass(c: string) {
    if (!chartClass) return;
    const include = chartClass.include.includes(c)
      ? chartClass.include.filter((x) => x !== c)
      : [...chartClass.include, c];
    setChartClass({ ...chartClass, include });
  }

  // class definition ของ project (preset ที่เลือกจะถูก copy เข้ามา)
  function addClassDef(def: ClassDef) {
    setClassDefs((prev) => {
      if (prev.some((d) => d.id === def.id)) return prev;
      const next = [...prev, def];
      patchProject({ classDefs: next });
      return next;
    });
  }

  function updatePanel(i: number, s: PanelSettings) {
    setPanels((prev) => {
      const next = [...prev];
      next[i] = s;
      return next;
    });
  }

  // ลากขอบซ้ายของแถบขวาเพื่อปรับความกว้าง
  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = rightWidth;
    const onMove = (ev: MouseEvent) => {
      const w = startW + (startX - ev.clientX);
      setRightWidth(Math.min(480, Math.max(180, w)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (!t) return;
    setActiveTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
  }

  function addFromInput() {
    // รองรับพิมพ์หลาย tag คั่น comma ในครั้งเดียว
    tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach(addTag);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setActiveTags((prev) => prev.filter((t) => t !== tag));
  }

  // กดเลือก/ยกเลิก tag บางตัวในกลุ่มลง chart
  function toggleTag(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  const isSaved = (tag: string) => saved.some((t) => t.tag === tag);
  const isActive = (tag: string) => activeTags.includes(tag);

  // tag/group เก็บใน project — เปลี่ยนแล้วบันทึกทันที
  function saveTags(next: SavedTag[]) {
    setSaved(next);
    patchProject({ tags: next });
  }

  function toggleSave(tag: string) {
    saveTags(
      isSaved(tag)
        ? saved.filter((t) => t.tag !== tag)
        : [...saved, { tag, description: descriptions[tag] ?? "", group: "" }],
    );
  }

  // tag ที่ยังไม่ save จะถูก save พร้อม group
  function setTagGroup(tag: string, group: string) {
    saveTags(
      isSaved(tag)
        ? saved.map((t) => (t.tag === tag ? { ...t, group } : t))
        : [...saved, { tag, description: descriptions[tag] ?? "", group }],
    );
  }

  // ---- ไฟล์ CSV/Excel ของ project ----
  function applyProject(p: Project) {
    setSaved(p.tags);
    setGroups(p.groups);
    setFiles(p.files ?? []);
  }

  async function fileRequest(init: RequestInit, query = "") {
    setUploading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${project.id}/files${query}`, init);
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "ไฟล์ผิดพลาด");
        return null;
      }
      applyProject(json);
      return json as Project;
    } catch {
      setMessage("อัปโหลดไม่สำเร็จ");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function uploadFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    const p = await fileRequest({ method: "POST", body: form });
    const f = p?.files?.[p.files.length - 1];
    if (f) setMessage(`${f.name}: ${f.rows.toLocaleString()} rows · ${f.columns.length} tags`);
  }

  function reingestFile(fileId: string, opts: { sheet?: string; timeColumn?: string }) {
    return fileRequest({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, ...opts }),
    });
  }

  async function deleteFile(f: ProjectFile) {
    if (!confirm(`ลบไฟล์ "${f.name}" และ tag ทั้งหมดของไฟล์นี้?`)) return;
    const p = await fileRequest({ method: "DELETE" }, `?fileId=${encodeURIComponent(f.id)}`);
    if (p) setActiveTags((prev) => prev.filter((t) => fileIdOfTag(t) !== f.id));
  }

  function createGroup() {
    const g = newGroup.trim();
    if (!g) return;
    if (!groups.includes(g)) {
      const next = [...groups, g];
      setGroups(next);
      patchProject({ groups: next });
    }
    setNewGroup("");
  }

  function groupedTags(): Record<string, SavedTag[]> {
    const map: Record<string, SavedTag[]> = {};
    for (const g of groups) map[g] = [];
    for (const t of saved) {
      const g = t.group?.trim() || UNGROUPED;
      if (!map[g]) map[g] = [];
      map[g].push(t);
    }
    return map;
  }

  function addGroupToChart(tags: SavedTag[]) {
    tags.forEach((t) => addTag(t.tag));
  }

  async function fetchData() {
    // toggle: ถ้ากราฟโชว์อยู่แล้ว กดซ้ำ = ซ่อน
    if (visible.chart && data) {
      setVisible((v) => ({ ...v, chart: false }));
      return;
    }
    await refreshChart();
  }

  // เรียก /filter/suggest เพื่อดูจำนวน outlier ที่จะถูกตัดต่อ tag (ไม่แก้ข้อมูล)
  async function suggestFilter(k: number) {
    const range = resolveRange();
    if (activeTags.length === 0 || !range) return;
    try {
      const res = await fetch("/api/filter/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "pi",
          tags: activeTags,
          start: range.start,
          end: range.end,
          interval,
          k,
        }),
      });
      const json = await res.json();
      if (res.ok) setIqrSuggest(json.tags ?? null);
    } catch {
      /* ignore */
    }
  }

  // ดึงข้อมูลใหม่ตาม activeTags ปัจจุบัน (ไม่ toggle) ใช้กับปุ่ม refresh
  async function refreshChart() {
    const tags = activeTags;
    if (tags.length === 0) {
      setMessage("Add at least one tag");
      return;
    }

    const range = resolveRange(tags);
    if (!range) {
      setMessage(
        preset === "file" ? "ยังไม่มีไฟล์ใน project" : "Select a custom time range",
      );
      return;
    }
    const { start, end } = range;

    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "pi",
          project: project.id,
          tags,
          start,
          end,
          interval,
          iqr: { enabled: iqrOn, k: iqrK },
          ...(chartClass && chartClassDef
            ? {
                classSpec: {
                  definition: chartClassDef,
                  mode: chartClass.mode,
                  include: chartClass.include,
                },
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.detail || json.error || "Failed to load data");
        setData(null);
        setChartClasses(null);
      } else {
        setData({ timestamps: json.timestamps, series: json.series });
        setChartClasses(json.classes ?? null);
        const descMap: Record<string, string> = {};
        const raw = json.meta?.descriptions ?? {};
        for (const [tag, info] of Object.entries(raw)) {
          descMap[tag] = (info as { description?: string })?.description ?? "";
        }
        setDescriptions(descMap);
        const removed = json.meta?.outliersRemoved ?? 0;
        setMessage(
          `${json.meta?.rows ?? 0} points` +
            (removed > 0 ? ` · ${removed} outliers removed` : ""),
        );
        setVisible((v) => ({ ...v, chart: true }));
      }
    } catch {
      setMessage("Service unreachable");
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  // วางเส้นใหม่จากการคลิกบนกราฟ (แก้ข้อความ label ทีหลังที่ chip ด้านล่าง)
  function placeAnnotation(a: { kind: "hline" | "vline"; value: number }) {
    setAnnotations((prev) => [
      ...prev,
      { id: crypto.randomUUID(), kind: a.kind, value: a.value },
    ]);
    setDrawMode("none");
  }

  function removeAnnotation(id: string) {
    setAnnotations((prev) => prev.filter((x) => x.id !== id));
  }

  function setAnnotationText(id: string, text: string) {
    setAnnotations((prev) =>
      prev.map((x) => (x.id === id ? { ...x, text: text || undefined } : x)),
    );
  }

  // tags: ใช้หาไฟล์ที่เกี่ยวข้องเมื่อเลือก "All (file)" (ไม่มี tag จากไฟล์ → ใช้ทุกไฟล์)
  function resolveRange(tags: string[] = activeTags): { start: string; end: string } | null {
    if (preset === "file") {
      const ids = new Set(tags.map(fileIdOfTag).filter(Boolean));
      const fs = files.filter((f) => ids.size === 0 || ids.has(f.id));
      if (fs.length === 0) return null;
      return {
        start: fs.map((f) => f.start).sort()[0],
        end: fs.map((f) => f.end).sort().reverse()[0],
      };
    }
    if (preset === "custom") {
      if (!customStart || !customEnd) return null;
      return {
        start: customStart.replace("T", " ") + ":00",
        end: customEnd.replace("T", " ") + ":00",
      };
    }
    return rangeFromPreset(preset);
  }

  const grouped = groupedTags();
  // รวม group จาก state + group ที่ save ไว้ในไฟล์ (กัน option หายจน dropdown ค้าง)
  const allGroups = Array.from(
    new Set([
      ...groups,
      ...saved.map((s) => s.group?.trim()).filter((g): g is string => !!g),
    ]),
  );

  return (
    <main className="h-screen overflow-hidden bg-black text-[12px] text-neutral-300">
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-1.5">
          <a
            href="/projects"
            className="text-[10px] text-neutral-500 hover:text-neutral-200"
            title="All projects"
          >
            ← Projects
          </a>
          <h1 className="text-xs font-semibold text-neutral-100">
            {project.name}
          </h1>
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">
              Time
            </span>
            <select
              className="input"
              value={preset}
              onChange={(e) => setPreset(e.target.value as RangePreset)}
            >
              <option value="1D">1 Day</option>
              <option value="1W">1 Week</option>
              <option value="1M">1 Month</option>
              <option value="custom">Custom</option>
              {(files.length > 0 || preset === "file") && (
                <option value="file">All (file)</option>
              )}
            </select>
          </div>
          {preset === "custom" && (
            <>
              <input
                className="input"
                type="datetime-local"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <input
                className="input"
                type="datetime-local"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </>
          )}
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">
              Interval
            </span>
            <select
              className="input"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="1d">1d</option>
            </select>
          </div>
          {mode === "chart" && visible.chart && (
            <button
              onClick={refreshChart}
              disabled={busy}
              title="Refresh chart with current tags"
              className="rounded bg-neutral-800 px-2 py-1 text-[11px] leading-none text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
            >
              ↻ Refresh
            </button>
          )}
          {mode === "chart" && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                Scale
              </span>
              <select
                className="input"
                value={scaleMode}
                onChange={(e) =>
                  setScaleMode(
                    e.target.value as "single" | "multiple" | "range",
                  )
                }
              >
                <option value="multiple">Multiple</option>
                <option value="single">Single</option>
                <option value="range">Range</option>
              </select>
              {scaleMode === "range" && (
                <>
                  <input
                    className="input w-16"
                    type="number"
                    value={scaleMin}
                    onChange={(e) => setScaleMin(e.target.value)}
                    placeholder="min"
                  />
                  <input
                    className="input w-16"
                    type="number"
                    value={scaleMax}
                    onChange={(e) => setScaleMax(e.target.value)}
                    placeholder="max"
                  />
                </>
              )}
            </div>
          )}
          <button
            onClick={() => setShowClassEditor(true)}
            title="Class Settings — สร้าง/แก้ class definition ของ project"
            className="rounded bg-neutral-800 px-2 py-1 text-[11px] leading-none text-neutral-300 hover:bg-neutral-700"
          >
            ⚙ Classes
          </button>
          {mode === "chart" && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                Class
              </span>
              <select
                className="input"
                value={chartClassDef ? chartClassDef.id : ""}
                onChange={(e) => selectChartClass(e.target.value)}
              >
                <option value="">(off)</option>
                {classDefs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                {classPresets.length > 0 && (
                  <optgroup label="Presets">
                    {classPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {chartClass && chartClassDef && (
                <>
                  <select
                    className="input"
                    value={chartClass.mode}
                    onChange={(e) =>
                      setChartClass({
                        ...chartClass,
                        mode: e.target.value as ChartClassUsage["mode"],
                      })
                    }
                    title="shade = แถบสีพื้นหลังตาม class · filter = ซ่อนจุดนอก class ที่เลือก"
                  >
                    <option value="shade">shade</option>
                    <option value="filter">filter</option>
                  </select>
                  {classLabels(chartClassDef).map((c) => {
                    const on = chartClass.include.includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() => toggleChartClass(c)}
                        className={`rounded border px-1.5 py-0.5 text-[10px] leading-none ${
                          on
                            ? "border-blue-600 bg-blue-600/20 text-blue-300"
                            : "border-neutral-800 text-neutral-600 line-through"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
          {message && (
            <span className="ml-auto text-[10px] text-neutral-500">
              {message}
            </span>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: mode switch */}
          <aside className="flex w-16 shrink-0 flex-col gap-2 overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-2">
            <button
              className={`rounded px-2 py-1 text-[10px] font-medium disabled:opacity-50 ${
                mode === "chart"
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              }`}
              onClick={() => {
                setMode("chart");
                refreshChart();
              }}
              disabled={busy}
            >
              {busy ? "..." : "Chart"}
            </button>
            <button
              className={`rounded px-2 py-1 text-[10px] font-medium ${
                mode === "analytics"
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              }`}
              onClick={() => setMode("analytics")}
            >
              Analytics
            </button>

            {mode === "analytics" && (
              <div className="border-t border-neutral-800 pt-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  Panels
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      className={`rounded py-1 text-[11px] ${
                        panelCount === n
                          ? "bg-neutral-700 text-white"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                      onClick={() => setPanelCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "chart" && visible.chart && data && data.timestamps.length > 0 && (
              <div className="border-t border-neutral-800 pt-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  Draw
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() =>
                      setDrawMode((m) => (m === "hline" ? "none" : "hline"))
                    }
                    className={`w-full rounded px-2 py-1 text-[13px] leading-none ${
                      drawMode === "hline"
                        ? "bg-amber-600 text-white"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                    title="เส้นแนวนอน: คลิกบนกราฟเพื่อวาง"
                  >
                    —
                  </button>
                  <button
                    onClick={() =>
                      setDrawMode((m) => (m === "vline" ? "none" : "vline"))
                    }
                    className={`w-full rounded px-2 py-1 text-[13px] leading-none ${
                      drawMode === "vline"
                        ? "bg-amber-600 text-white"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                    title="เส้นแนวตั้ง: คลิกบนกราฟเพื่อวาง"
                  >
                    |
                  </button>
                  {annotations.length > 0 && (
                    <button
                      onClick={() => setAnnotations([])}
                      className="w-full rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300 hover:bg-red-700 hover:text-white"
                      title="ล้างเส้นทั้งหมด"
                    >
                      Clear ({annotations.length})
                    </button>
                  )}
                </div>
                {drawMode !== "none" && (
                  <div className="mt-1 text-[10px] text-amber-400">
                    คลิกบนกราฟเพื่อวางเส้น
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* CENTER: chart mode หรือ analytics mode */}
          {mode === "chart" ? (
            <section className="flex-1 overflow-y-auto p-3">
              {visible.chart && data && data.timestamps.length > 0 ? (
                <>
                  <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
                    <ChartCanvas
                      data={data}
                      interval={interval}
                      descriptions={descriptions}
                      scaleMode={scaleMode}
                      scaleMin={scaleMin === "" ? undefined : Number(scaleMin)}
                      scaleMax={scaleMax === "" ? undefined : Number(scaleMax)}
                      drawMode={drawMode}
                      annotations={annotations}
                      onPlaceAnnotation={placeAnnotation}
                      classBands={
                        chartClasses && chartClass?.mode === "shade"
                          ? bandsFromClasses(chartClasses)
                          : []
                      }
                      classOrder={chartClassDef ? classLabels(chartClassDef) : []}
                    />
                  </div>
                  {annotations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {annotations.map((a) => (
                        <span
                          key={a.id}
                          className="flex items-center gap-1 rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-[10px] text-neutral-300"
                        >
                          <span className="text-amber-400">
                            {a.kind === "hline" ? "—" : "|"}
                          </span>
                          {a.kind === "hline"
                            ? a.value.toFixed(2)
                            : data.timestamps[a.value]
                              ? new Date(
                                  data.timestamps[a.value],
                                ).toLocaleString()
                              : `#${a.value}`}
                          <input
                            value={a.text || ""}
                            onChange={(e) =>
                              setAnnotationText(a.id, e.target.value)
                            }
                            placeholder="label"
                            className="w-20 rounded border border-neutral-700 bg-black px-1 text-[10px] text-neutral-200"
                          />
                          <button
                            onClick={() => removeAnnotation(a.id)}
                            className="text-neutral-500 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {Object.keys(data.series).length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                        Summary
                      </div>
                      <div className="overflow-x-auto rounded border border-neutral-800 bg-neutral-950">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-neutral-500">
                              <th className="px-2 py-1 text-left font-medium">
                                Tag
                              </th>
                              {(
                                [
                                  "count",
                                  "min",
                                  "max",
                                  "mean",
                                  "median",
                                  "std",
                                ] as const
                              ).map((m) => (
                                <th
                                  key={m}
                                  className="px-2 py-1 text-right font-medium capitalize"
                                >
                                  {m}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(data.series).map(([tag, vals]) => {
                              const s = computeStats(vals);
                              return (
                                <tr
                                  key={tag}
                                  className="border-t border-neutral-800/60 text-neutral-300"
                                >
                                  <td
                                    className="max-w-[220px] truncate px-2 py-0.5 font-medium text-neutral-200"
                                    title={descriptions[tag] || tag}
                                  >
                                    {descriptions[tag] || displayTag(tag)}
                                  </td>
                                  <td className="px-2 py-0.5 text-right tabular-nums">
                                    {s.count}
                                  </td>
                                  <td className="px-2 py-0.5 text-right tabular-nums">
                                    {fmtNum(s.min)}
                                  </td>
                                  <td className="px-2 py-0.5 text-right tabular-nums">
                                    {fmtNum(s.max)}
                                  </td>
                                  <td className="px-2 py-0.5 text-right tabular-nums">
                                    {fmtNum(s.mean)}
                                  </td>
                                  <td className="px-2 py-0.5 text-right tabular-nums">
                                    {fmtNum(s.median)}
                                  </td>
                                  <td className="px-2 py-0.5 text-right tabular-nums">
                                    {fmtNum(s.std)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-64 items-center justify-center rounded border border-dashed border-neutral-800 text-[11px] text-neutral-600">
                  Add tags on the right, then click Chart
                </div>
              )}
            </section>
          ) : (
            <section className="flex-1 overflow-hidden p-3">
              <div
                className={`grid h-full gap-2 ${
                  panelCount === 1 ? "grid-cols-1" : "grid-cols-2"
                } ${panelCount <= 2 ? "grid-rows-1" : "grid-rows-2"}`}
              >
                {Array.from({ length: panelCount }, (_, i) => (
                  <AnalyticsPanel
                    key={i}
                    saved={saved}
                    descriptions={descriptions}
                    interval={interval}
                    resolveRange={resolveRange}
                    projectId={project.id}
                    initial={panels[i]}
                    onSettingsChange={(s) => updatePanel(i, s)}
                    classDefs={classDefs}
                    onAddClassDef={addClassDef}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Drag handle + collapse toggle */}
          {rightOpen && (
            <div
              onMouseDown={startResize}
              className="w-1 shrink-0 cursor-col-resize bg-neutral-800 hover:bg-blue-500"
              title="Drag to resize"
            />
          )}
          <button
            onClick={() => setRightOpen((o) => !o)}
            className="flex w-5 shrink-0 items-center justify-center border-l border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-200"
            title={rightOpen ? "Collapse" : "Expand"}
          >
            {rightOpen ? "›" : "‹"}
          </button>

          {/* RIGHT: tags + groups */}
          {rightOpen && (
            <aside
              style={{ width: rightWidth }}
              className="flex shrink-0 flex-col gap-3 overflow-y-auto bg-neutral-950 p-3"
            >
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                Add Tag
              </div>
              <div className="flex gap-1">
                <input
                  className="input flex-1"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addFromInput();
                  }}
                  placeholder="Type a tag, press Enter"
                />
                <button
                  className="rounded bg-neutral-800 px-2 text-[11px] text-neutral-200 hover:bg-neutral-700"
                  onClick={addFromInput}
                >
                  Add
                </button>
              </div>
            </div>

            {activeTags.length > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-neutral-500">
                  <span>On Chart</span>
                </div>
                <div className="flex flex-col gap-1">
                  {activeTags.map((tag) => (
                    <div
                      key={tag}
                      title={
                        descriptions[tag]
                          ? `${tag} — ${descriptions[tag]}`
                          : tag
                      }
                      className="flex items-center gap-1 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[10px]"
                    >
                      <span className="flex-1 truncate">{displayTag(tag)}</span>
                      <select
                        className="mini"
                        value={saved.find((s) => s.tag === tag)?.group || ""}
                        onChange={(e) => setTagGroup(tag, e.target.value)}
                        title="Assign group"
                      >
                        <option value="">—</option>
                        {allGroups.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => toggleSave(tag)}
                        title={isSaved(tag) ? "Unsave" : "Save"}
                        className={
                          isSaved(tag)
                            ? "text-red-500"
                            : "text-neutral-600 hover:text-neutral-300"
                        }
                      >
                        ⚑
                      </button>
                      <button
                        onClick={() => removeTag(tag)}
                        title="Remove"
                        className="text-neutral-600 hover:text-neutral-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-neutral-800 pt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-neutral-500">
                <span>Files (CSV / Excel)</span>
                <label
                  className={`cursor-pointer rounded bg-neutral-800 px-2 py-0.5 normal-case text-neutral-200 hover:bg-neutral-700 ${
                    uploading ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  {uploading ? "กำลังอ่าน…" : "⬆ Upload"}
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) uploadFile(f);
                    }}
                  />
                </label>
              </div>
              {files.length === 0 ? (
                <p className="text-[10px] text-neutral-600">
                  column แรก = เวลา, column ตัวเลข = tag (ใช้ร่วมกับ PI tag ไม่ได้)
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="rounded border border-neutral-800 bg-neutral-900 p-1.5 text-[10px]"
                    >
                      <div className="flex items-center gap-1">
                        <span className="flex-1 truncate font-medium text-neutral-200" title={f.name}>
                          {f.name}
                        </span>
                        <button
                          onClick={() => deleteFile(f)}
                          title="ลบไฟล์"
                          className="text-neutral-600 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-neutral-500">
                        {f.rows.toLocaleString()} rows · {f.columns.length} tags
                        <br />
                        {f.start} → {f.end}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-neutral-500">
                        {f.sheets.length > 1 && (
                          <select
                            className="mini"
                            value={f.sheet ?? ""}
                            disabled={uploading}
                            onChange={(e) => reingestFile(f.id, { sheet: e.target.value })}
                            title="Sheet"
                          >
                            {f.sheets.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                        <span>เวลา</span>
                        <select
                          className="mini"
                          value={f.timeColumn}
                          disabled={uploading}
                          onChange={(e) => reingestFile(f.id, { timeColumn: e.target.value })}
                          title="Column เวลา"
                        >
                          {f.allColumns.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-neutral-800 pt-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                New Group
              </div>
              <div className="flex gap-1">
                <input
                  className="input flex-1"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createGroup();
                  }}
                  placeholder="e.g. LAB, Sensor"
                />
                <button
                  className="rounded bg-neutral-800 px-2 text-[11px] text-neutral-200 hover:bg-neutral-700"
                  onClick={createGroup}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {Object.entries(grouped).map(([group, tags]) => (
                <div
                  key={group}
                  className="rounded border border-neutral-800 bg-neutral-900 p-2"
                >
                  <button
                    className="mb-1 w-full text-left text-[10px] font-semibold text-neutral-200 hover:text-blue-400"
                    onClick={() => addGroupToChart(tags)}
                    title="Plot all tags in this group"
                  >
                    {group}{" "}
                    <span className="text-[10px] font-normal text-neutral-500">
                      ({tags.length})
                    </span>
                  </button>
                  {tags.length === 0 ? (
                    <p className="text-[10px] text-neutral-600">Empty</p>
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {tags.map((t) => (
                        <li key={t.tag} className="flex items-center gap-1">
                          <button
                            className={`flex-1 truncate rounded px-1.5 py-0.5 text-left text-[10px] ${
                              isActive(t.tag)
                                ? "font-semibold text-blue-400"
                                : "text-neutral-400 hover:text-neutral-200"
                            }`}
                            onClick={() => toggleTag(t.tag)}
                            title={
                              t.description
                                ? `${t.tag} — ${t.description}`
                                : t.tag
                            }
                          >
                            {displayTag(t.tag)}
                          </button>
                          <select
                            className="mini"
                            value={t.group || ""}
                            onChange={(e) => setTagGroup(t.tag, e.target.value)}
                            title="Change group"
                          >
                            <option value="">—</option>
                            {allGroups.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {activeTags.length > 0 && (
              <div className="border-t border-neutral-800 pt-3">
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-neutral-500">
                  <span>Outlier Filter (IQR)</span>
                  <label className="flex cursor-pointer items-center gap-1 normal-case">
                    <input
                      type="checkbox"
                      checked={iqrOn}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setIqrOn(on);
                        if (on) suggestFilter(iqrK);
                        else setIqrSuggest(null);
                      }}
                    />
                    <span className="text-[10px] text-neutral-400">
                      {iqrOn ? "On" : "Off"}
                    </span>
                  </label>
                </div>
                {iqrOn && (
                  <div className="rounded border border-neutral-800 bg-neutral-900 p-2">
                    {iqrSuggest && (
                      <div className="text-[10px] text-neutral-400">
                        จะตัด{" "}
                        <span className="font-semibold text-amber-400">
                          {iqrSuggest.reduce((a, t) => a + t.outliers, 0)}
                        </span>{" "}
                        จุด จาก{" "}
                        {iqrSuggest.reduce((a, t) => a + t.total, 0)} จุด
                      </div>
                    )}
                    <button
                      onClick={refreshChart}
                      disabled={busy}
                      className="mt-2 w-full rounded bg-blue-600 py-1 text-[10px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      Apply
                    </button>
                    <p className="mt-1 text-[9px] leading-tight text-neutral-600">
                      ตัดค่าผิดปกติอัตโนมัติ (IQR, k=1.5)
                    </p>
                  </div>
                )}
              </div>
            )}
            </aside>
          )}
        </div>
      </div>

      {showClassEditor && (
        <ClassDefEditor
          defs={classDefs}
          tags={saved}
          usedIds={usedClassIds}
          onSave={saveClassDefs}
          onClose={() => setShowClassEditor(false)}
        />
      )}

      <style jsx>{`
        .input {
          background: #0a0a0a;
          border: 1px solid #262626;
          border-radius: 4px;
          padding: 3px 6px;
          font-size: 11px;
          color: #e5e5e5;
        }
        .input:focus {
          outline: none;
          border-color: #3b82f6;
        }
        .mini {
          background: #0a0a0a;
          border: 1px solid #262626;
          border-radius: 3px;
          font-size: 9px;
          color: #a3a3a3;
          padding: 1px 2px;
        }
      `}</style>
    </main>
  );
}
