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
}: {
  saved: SavedTag[];
  descriptions: Record<string, string>;
  interval: string;
  resolveRange: () => Range | null;
}) {
  const [type, setType] = useState<AnalysisKind>("sd");
  const [tags, setTags] = useState<string[]>([]);
  const [xTags, setXTags] = useState<string[]>([]);
  const [yTags, setYTags] = useState<string[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const single = SINGLE_TAG.includes(type);
  const isCorr = type === "correlation";
  const label = (t: string) => descriptions[t] || t;

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
    const range = resolveRange();
    if (!range) {
      setMsg("เลือกช่วงเวลา custom ก่อน");
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
          ...(isCorr ? { xTags, yTags } : { tags }),
          start: range.start,
          end: range.end,
          interval,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.detail || json.error || "Analysis failed");
        setResult(null);
        return;
      }
      setResult(json.result ?? null);
    } catch {
      setMsg("Service unreachable");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  // เลือก type/tag ครบแล้ว auto-run ทันที (ไม่ต้องกดปุ่ม)
  useEffect(() => {
    run.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, tags, xTags, yTags, interval]);

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
        {busy && <span className="ml-auto text-[10px] text-neutral-500">…</span>}
      </div>

      {/* Result */}
      <div className="min-h-0 flex-1 overflow-hidden p-1">
        {msg && <div className="mb-1 text-[10px] text-amber-400">{msg}</div>}
        {!result && !msg && (
          <div className="flex h-full items-center justify-center text-[11px] text-neutral-600">
            เลือก type + tag
          </div>
        )}
        {result != null && (
          <ResultView type={type} result={result} descriptions={descriptions} />
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
              <td className="px-2 py-1">{r.tag}</td>
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
        label={(t) => descriptions[t] || t}
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
      <ClusterCanvas data={d} descriptions={descriptions} height="100%" />
    );
  }
  return <Empty />;
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-[11px] text-neutral-600">
      ไม่มีข้อมูล
    </div>
  );
}
