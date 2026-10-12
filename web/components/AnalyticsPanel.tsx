"use client";

import { useEffect, useRef, useState } from "react";
import BoxplotCanvas, { BoxplotData } from "@/components/BoxplotCanvas";
import CorrelationHeatmap, {
  CorrelationData,
} from "@/components/CorrelationHeatmap";
import SdBandCanvas, { SdData } from "@/components/SdBandCanvas";
import KdeCanvas, { KdeData } from "@/components/KdeCanvas";
import HistogramCanvas, { HistogramData } from "@/components/HistogramCanvas";
import ClusterCanvas, { ClusterData } from "@/components/ClusterCanvas";
import { CLASS_PRESETS } from "@/lib/classPresets";
import {
  classLabels,
  displayTag,
  classTagsOf,
  type ClassDef,
  type ClassUsage,
  type PanelSettings,
} from "@/lib/types";

export type AnalysisKind =
  | "summary"
  | "boxplot"
  | "correlation"
  | "sd"
  | "kde"
  | "histogram"
  | "clustering";

export const ANALYSIS_TOOLS: { key: AnalysisKind; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "boxplot", label: "Boxplot" },
  { key: "correlation", label: "Correlation" },
  { key: "sd", label: "SD Band" },
  { key: "kde", label: "KDE" },
  { key: "histogram", label: "Histogram" },
  { key: "clustering", label: "Clustering" },
];

// analysis ที่โฟกัส tag เดี่ยว (เลือกได้ 1 tag)
const SINGLE_TAG: AnalysisKind[] = ["sd", "kde", "histogram"];
// analysis ที่ต้องมีอย่างน้อย 2 tag
const MULTI_MIN2: AnalysisKind[] = ["correlation", "clustering"];
// analysis ที่แบ่ง class ได้ (correlation ใช้ได้แค่ filter)
const CLASS_TYPES: AnalysisKind[] = [
  "summary",
  "boxplot",
  "histogram",
  "kde",
  "sd",
  "correlation",
  "clustering",
];
const FILTER_ONLY: AnalysisKind[] = ["correlation"];

// จำนวนจุดต่อ class จาก backend (used = class ที่ถูกใช้, ที่เหลือถูกตัดทิ้ง)
interface ClassInfo {
  points: number;
  counts: Record<string, number>;
  used: string[];
}

export interface SummaryRow {
  tag: string;
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  std: number | null;
}

export interface SavedTag {
  tag: string;
  description?: string;
  group?: string;
}

interface Range {
  start: string;
  end: string;
}

export default function AnalyticsPanel({
  saved,
  descriptions,
  interval,
  resolveRange,
  projectId,
  initial,
  onSettingsChange,
  classDefs,
  onAddClassDef,
}: {
  saved: SavedTag[];
  descriptions: Record<string, string>;
  interval: string;
  resolveRange: (tags?: string[]) => Range | null; // tags ใช้หาช่วงเวลาไฟล์
  projectId: string;
  initial?: PanelSettings; // ค่าที่จำไว้ใน project
  onSettingsChange?: (s: PanelSettings) => void;
  classDefs: ClassDef[]; // class definition ของ project
  onAddClassDef: (def: ClassDef) => void; // copy preset เข้า project
}) {
  const [type, setType] = useState<AnalysisKind>(
    (initial?.type as AnalysisKind) ?? "sd",
  );
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [xTags, setXTags] = useState<string[]>(initial?.xTags ?? []);
  const [yTags, setYTags] = useState<string[]>(initial?.yTags ?? []);
  const [classUse, setClassUse] = useState<ClassUsage | null>(
    initial?.classUse ?? null,
  );

  // แจ้ง page ให้บันทึกลง project เมื่อค่าเปลี่ยน
  useEffect(() => {
    onSettingsChange?.({ type, tags, xTags, yTags, classUse });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, tags, xTags, yTags, classUse]);
  const [result, setResult] = useState<unknown>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // clustering: null = เลือก k อัตโนมัติด้วย Elbow method (ไม่จำค่าไว้ใน project)
  const [k, setK] = useState<number | null>(null);

  const single = SINGLE_TAG.includes(type);
  const isCorr = type === "correlation";
  const label = (t: string) => descriptions[t] || displayTag(t);

  const canClass = CLASS_TYPES.includes(type);
  const classDef = classUse
    ? classDefs.find((d) => d.id === classUse.defId) ?? null
    : null;
  const presets = CLASS_PRESETS.filter(
    (p) => !classDefs.some((d) => d.id === p.id),
  );

  // เลือก definition: preset จะถูก copy เข้า project ก่อน · ค่าเริ่มต้น split ทุก class
  function selectClassDef(id: string) {
    if (!id) return setClassUse(null);
    const def =
      classDefs.find((d) => d.id === id) ?? presets.find((p) => p.id === id);
    if (!def) return;
    if (!classDefs.some((d) => d.id === id)) onAddClassDef(def);
    setClassUse({ defId: id, mode: "split", include: classLabels(def) });
  }

  function toggleInclude(c: string) {
    if (!classUse) return;
    const include = classUse.include.includes(c)
      ? classUse.include.filter((x) => x !== c)
      : [...classUse.include, c];
    setClassUse({ ...classUse, include });
  }

  function changeType(next: AnalysisKind) {
    setResult(null);
    setMsg("");
    // ถ้าเปลี่ยนเป็นโหมด tag เดี่ยว ให้เหลือ tag เดียว
    if (SINGLE_TAG.includes(next)) {
      setTags((prev) => (prev.length > 1 ? [prev[0]] : prev));
    }
    setType(next);
  }

  function toggleTag(tag: string) {
    if (single) {
      setTags([tag]);
      return;
    }
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  const run = useRef<() => void>(() => {});
  run.current = async () => {
    if (isCorr) {
      if (xTags.length === 0 || yTags.length === 0) {
        setResult(null);
        setMsg(xTags.length || yTags.length ? "เลือก tag ทั้งแกน X และ Y" : "");
        return;
      }
    } else if (tags.length === 0) {
      setResult(null);
      setMsg("");
      return;
    } else if (MULTI_MIN2.includes(type) && tags.length < 2) {
      setMsg("ต้องเลือกอย่างน้อย 2 tags");
      return;
    }
    const range = resolveRange(
      isCorr ? [...xTags, ...yTags] : [...tags, ...(classDef ? classTagsOf(classDef) : [])],
    );
    if (!range) {
      setMsg("เลือกช่วงเวลา custom ก่อน (หรือ project ยังไม่มีไฟล์)");
      return;
    }
    const useClass = canClass && classUse && classDef;
    const classMode =
      classUse && FILTER_ONLY.includes(type) ? "filter" : classUse?.mode;
    if (useClass && classUse.include.length === 0) {
      setResult(null);
      setMsg("เลือกอย่างน้อย 1 class");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          source: "pi",
          project: projectId,
          ...(isCorr ? { xTags, yTags } : { tags }),
          ...(type === "clustering" ? { k } : {}),
          ...(useClass
            ? {
                classSpec: {
                  definition: classDef,
                  mode: classMode,
                  include: classUse.include,
                },
              }
            : {}),
          start: range.start,
          end: range.end,
          interval,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.detail || json.error || "Analysis failed");
        setResult(null);
        setClassInfo(null);
        return;
      }
      setResult(json.result ?? null);
      setClassInfo(json.classInfo ?? null);
    } catch {
      setMsg("Service unreachable");
      setResult(null);
      setClassInfo(null);
    } finally {
      setBusy(false);
    }
  };

  // เลือก type/tag ครบแล้ว auto-run ทันที (ไม่ต้องกดปุ่ม)
  useEffect(() => {
    run.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, tags, xTags, yTags, classUse, classDef, interval, k]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded border border-neutral-800 bg-neutral-950">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800 p-1">
        <select
          className="rounded border border-neutral-800 bg-black px-1.5 py-0.5 text-[10px] text-neutral-300 focus:border-blue-500 focus:outline-none"
          value={type}
          onChange={(e) => changeType(e.target.value as AnalysisKind)}
        >
          {ANALYSIS_TOOLS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {isCorr ? (
          <>
            <span className="text-[10px] text-neutral-500">X</span>
            <TagPicker
              saved={saved}
              selected={xTags}
              single={false}
              onToggle={(t) =>
                setXTags((p) =>
                  p.includes(t) ? p.filter((x) => x !== t) : [...p, t],
                )
              }
              label={label}
            />
            <span className="text-[10px] text-neutral-500">Y</span>
            <TagPicker
              saved={saved}
              selected={yTags}
              single={false}
              onToggle={(t) =>
                setYTags((p) =>
                  p.includes(t) ? p.filter((y) => y !== t) : [...p, t],
                )
              }
              label={label}
            />
          </>
        ) : (
          <TagPicker
            saved={saved}
            selected={tags}
            single={single}
            onToggle={toggleTag}
            label={label}
          />
        )}
        {canClass && (
          <>
            <span className="ml-1 text-[10px] text-neutral-500">Class</span>
            <select
              className="rounded border border-neutral-800 bg-black px-1.5 py-0.5 text-[10px] text-neutral-300 focus:border-blue-500 focus:outline-none"
              value={classDef ? classDef.id : ""}
              onChange={(e) => selectClassDef(e.target.value)}
            >
              <option value="">(off)</option>
              {classDefs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              {presets.length > 0 && (
                <optgroup label="Presets">
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {classUse && classDef && (
              <>
                {FILTER_ONLY.includes(type) ? (
                  <span className="text-[10px] text-neutral-500">filter</span>
                ) : (
                  <select
                    className="rounded border border-neutral-800 bg-black px-1.5 py-0.5 text-[10px] text-neutral-300 focus:border-blue-500 focus:outline-none"
                    value={classUse.mode}
                    onChange={(e) =>
                      setClassUse({
                        ...classUse,
                        mode: e.target.value as ClassUsage["mode"],
                      })
                    }
                    title={
                      type === "clustering"
                        ? "filter = k-means เฉพาะ class ที่เลือก · split = ระบายสี/เทียบ cluster กับ class"
                        : "filter = ใช้เฉพาะ class ที่เลือก · split = แยกผลตาม class"
                    }
                  >
                    <option value="split">split</option>
                    <option value="filter">filter</option>
                  </select>
                )}
                {classLabels(classDef).map((c) => {
                  const on = classUse.include.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleInclude(c)}
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
          </>
        )}
        {type === "clustering" && (
          <>
            <span className="ml-1 text-[10px] text-neutral-500">k</span>
            <select
              className="rounded border border-neutral-800 bg-black px-1.5 py-0.5 text-[10px] text-neutral-300 focus:border-blue-500 focus:outline-none"
              value={k ?? "auto"}
              onChange={(e) =>
                setK(e.target.value === "auto" ? null : Number(e.target.value))
              }
              title="จำนวน cluster · auto = เลือกด้วย Elbow method"
            >
              <option value="auto">auto</option>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          onClick={() => run.current()}
          disabled={busy}
          title="Refresh analysis"
          className="ml-auto rounded border border-neutral-800 bg-neutral-800 px-2 py-0.5 text-[10px] leading-none text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
        >
          ↻ Refresh
        </button>
        {busy && <span className="text-[10px] text-neutral-500">…</span>}
      </div>

      {/* Result */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1">
        {msg && <div className="mb-1 text-[10px] text-amber-400">{msg}</div>}
        {classInfo && result != null && <ClassInfoLine info={classInfo} />}
        {!result && !msg && (
          <div className="flex h-full items-center justify-center text-[11px] text-neutral-600">
            เลือก type + tag
          </div>
        )}
        {result != null && (
          <div className="min-h-0 flex-1">
            <ResultView type={type} result={result} descriptions={descriptions} />
          </div>
        )}
      </div>
    </div>
  );
}

function TagPicker({
  saved,
  selected,
  single,
  onToggle,
  label,
}: {
  saved: SavedTag[];
  selected: string[];
  single: boolean;
  onToggle: (tag: string) => void;
  label: (t: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const text =
    selected.length === 0
      ? "เลือก tag"
      : single
        ? label(selected[0])
        : `${selected.length} tags`;

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1 rounded border border-neutral-800 bg-black px-1.5 py-0.5 text-[10px] text-neutral-300 hover:border-neutral-600"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="max-w-[110px] truncate">{text}</span>
        <span className="text-neutral-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-56 overflow-auto rounded border border-neutral-700 bg-black p-1 shadow-lg">
          {saved.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-neutral-600">
              ยังไม่มี saved tag
            </div>
          )}
          {saved.map((s) => {
            const picked = selected.includes(s.tag);
            return (
              <button
                key={s.tag}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11px] ${
                  picked
                    ? "text-blue-400"
                    : "text-neutral-300 hover:bg-neutral-800"
                }`}
                onClick={() => {
                  onToggle(s.tag);
                  if (single) setOpen(false);
                }}
                title={s.tag}
              >
                <span className="truncate">{label(s.tag)}</span>
                {picked && <span>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultView({
  type,
  result,
  descriptions,
}: {
  type: AnalysisKind;
  result: unknown;
  descriptions: Record<string, string>;
}) {
  if (type === "summary") {
    const rows = result as SummaryRow[];
    if (!rows?.length) return <Empty />;
    return (
      <div className="h-full overflow-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-neutral-500">
            <th className="px-2 py-1 text-left font-medium">Tag</th>
            <th className="px-2 py-1 text-right font-medium">Count</th>
            <th className="px-2 py-1 text-right font-medium">Min</th>
            <th className="px-2 py-1 text-right font-medium">Max</th>
            <th className="px-2 py-1 text-right font-medium">Mean</th>
            <th className="px-2 py-1 text-right font-medium">Median</th>
            <th className="px-2 py-1 text-right font-medium">Std</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.tag}
              className="border-t border-neutral-800/60 text-neutral-300"
            >
              <td className="px-2 py-1" title={r.tag}>{displayTag(r.tag)}</td>
              <td className="px-2 py-1 text-right">{r.count}</td>
              <td className="px-2 py-1 text-right">{r.min ?? "-"}</td>
              <td className="px-2 py-1 text-right">{r.max ?? "-"}</td>
              <td className="px-2 py-1 text-right">{r.mean ?? "-"}</td>
              <td className="px-2 py-1 text-right">{r.median ?? "-"}</td>
              <td className="px-2 py-1 text-right">{r.std ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    );
  }
  if (type === "boxplot") {
    const d = result as BoxplotData;
    if (!d?.tags?.length) return <Empty />;
    return <BoxplotCanvas data={d} height="100%" />;
  }
  if (type === "correlation") {
    const d = result as CorrelationData;
    if (!d?.matrix?.length) return <Empty />;
    return (
      <CorrelationHeatmap
        data={d}
        height="100%"
        label={(t) => descriptions[t] || displayTag(t)}
      />
    );
  }
  if (type === "sd") {
    const d = result as SdData;
    if (!d?.series?.length) return <Empty />;
    return <SdBandCanvas data={d} descriptions={descriptions} height="100%" />;
  }
  if (type === "kde") {
    const d = result as KdeData;
    if (!d?.curves?.length) return <Empty />;
    return <KdeCanvas data={d} descriptions={descriptions} height="100%" />;
  }
  if (type === "histogram") {
    const d = result as HistogramData;
    if (!d?.series?.length) return <Empty />;
    return (
      <HistogramCanvas data={d} descriptions={descriptions} height="100%" />
    );
  }
  if (type === "clustering") {
    const d = result as ClusterData;
    if (!d?.points?.length) return <Empty />;
    return (
      <div className="flex h-full gap-2">
        <div className="min-w-0 flex-1">
          <ClusterCanvas data={d} descriptions={descriptions} height="100%" />
        </div>
        {d.elbow && d.elbow.curve.length > 0 && <ElbowPlot elbow={d.elbow} />}
      </div>
    );
  }
  return <Empty />;
}

// กราฟ inertia vs k สำหรับ Elbow method (จุดที่เลือกเป็นสีฟ้า)
function ElbowPlot({ elbow }: { elbow: NonNullable<ClusterData["elbow"]> }) {
  const W = 170;
  const H = 150;
  const P = 22;
  const ks = elbow.curve.map((c) => c.k);
  const ins = elbow.curve.map((c) => c.inertia);
  const kMin = ks[0];
  const kMax = ks[ks.length - 1];
  const iMin = Math.min(...ins);
  const iMax = Math.max(...ins);
  const x = (k: number) => P + ((k - kMin) / Math.max(1, kMax - kMin)) * (W - 2 * P);
  const y = (v: number) =>
    H - P - ((v - iMin) / Math.max(1e-9, iMax - iMin)) * (H - 2 * P);
  const path = elbow.curve
    .map((c, i) => `${i ? "L" : "M"}${x(c.k).toFixed(1)},${y(c.inertia).toFixed(1)}`)
    .join(" ");

  return (
    <div className="shrink-0 rounded border border-neutral-800 p-1 text-[10px] text-neutral-400">
      <div className="mb-0.5">Elbow → k = {elbow.chosen}</div>
      <svg width={W} height={H}>
        <path d={path} fill="none" stroke="#525252" strokeWidth={1.5} />
        {elbow.curve.map((c) => {
          const on = c.k === elbow.chosen;
          return (
            <g key={c.k}>
              <circle
                cx={x(c.k)}
                cy={y(c.inertia)}
                r={on ? 4 : 2.5}
                fill={on ? "#3b82f6" : "#737373"}
              >
                <title>{`k=${c.k} · inertia ${c.inertia}`}</title>
              </circle>
              <text
                x={x(c.k)}
                y={H - 6}
                textAnchor="middle"
                fontSize={8}
                fill={on ? "#93c5fd" : "#737373"}
              >
                {c.k}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="text-center text-[9px] text-neutral-600">inertia vs k</div>
    </div>
  );
}

// จำนวนจุดที่ใช้ต่อ class + ที่ถูกตัดทิ้ง (class ที่ไม่ได้เลือก / none / NaN)
function ClassInfoLine({ info }: { info: ClassInfo }) {
  const used = info.used.map((c) => `${c} ${info.counts[c] ?? 0}`);
  const dropped = Object.entries(info.counts)
    .filter(([c]) => !info.used.includes(c))
    .map(([c, n]) => `${c} ${n}`);
  return (
    <div className="px-1 pb-1 text-[10px] text-neutral-500">
      Class: {used.join(" · ")}
      {dropped.length > 0 && (
        <span className="text-neutral-600"> · ตัดทิ้ง: {dropped.join(" · ")}</span>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-[11px] text-neutral-600">
      ไม่มีข้อมูล
    </div>
  );
}
