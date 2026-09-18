"use client";

import { useEffect, useState } from "react";
import ChartCanvas, { ChartData } from "@/components/ChartCanvas";
import AnalyticsPanel from "@/components/AnalyticsPanel";

type RangePreset = "1D" | "1W" | "1M" | "custom";

interface SavedTag {
  tag: string;
  description?: string;
  group?: string;
}

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
  const v = values.filter((x): x is number => x != null && !Number.isNaN(x));
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

export default function ChartPage() {
  const [activeTags, setActiveTags] = useState<string[]>([
    "PULP-LINE2-KAPPA-PRESS1",
  ]);
  const [tagInput, setTagInput] = useState("");
  const [preset, setPreset] = useState<RangePreset>("1D");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [interval, setInterval] = useState("1h");
  const [data, setData] = useState<ChartData | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<SavedTag[]>([]);
  const [visible, setVisible] = useState({ chart: false });
  const [mode, setMode] = useState<Mode>("chart");
  const [panelCount, setPanelCount] = useState(1);
  const [newGroup, setNewGroup] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightWidth, setRightWidth] = useState(256);

  useEffect(() => {
    loadSaved();
  }, []);

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

  async function loadSaved() {
    try {
      const res = await fetch("/api/tags");
      const json = await res.json();
      setSaved(json.tags ?? []);
    } catch {
      /* ignore */
    }
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

  async function toggleSave(tag: string) {
    if (isSaved(tag)) {
      await fetch(`/api/tags?tag=${encodeURIComponent(tag)}`, {
        method: "DELETE",
      });
    } else {
      await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, description: descriptions[tag] ?? "" }),
      });
    }
    loadSaved();
  }

  async function setTagGroup(tag: string, group: string) {
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag, description: descriptions[tag] ?? "", group }),
    });
    loadSaved();
  }

  function createGroup() {
    const g = newGroup.trim();
    if (!g) return;
    setGroups((prev) => (prev.includes(g) ? prev : [...prev, g]));
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

  // ดึงข้อมูลใหม่ตาม activeTags ปัจจุบัน (ไม่ toggle) ใช้กับปุ่ม refresh
  async function refreshChart() {
    const tags = activeTags;
    if (tags.length === 0) {
      setMessage("Add at least one tag");
      return;
    }

    let start: string;
    let end: string;
    if (preset === "custom") {
      if (!customStart || !customEnd) {
        setMessage("Select a custom time range");
        return;
      }
      start = customStart.replace("T", " ") + ":00";
      end = customEnd.replace("T", " ") + ":00";
    } else {
      ({ start, end } = rangeFromPreset(preset));
    }

    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "pi", tags, start, end, interval }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.detail || json.error || "Failed to load data");
        setData(null);
      } else {
        setData({ timestamps: json.timestamps, series: json.series });
        const descMap: Record<string, string> = {};
        const raw = json.meta?.descriptions ?? {};
        for (const [tag, info] of Object.entries(raw)) {
          descMap[tag] = (info as { description?: string })?.description ?? "";
        }
        setDescriptions(descMap);
        setMessage(`${json.meta?.rows ?? 0} points`);
        setVisible((v) => ({ ...v, chart: true }));
      }
    } catch {
      setMessage("Service unreachable");
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  function resolveRange(): { start: string; end: string } | null {
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
          <h1 className="text-xs font-semibold text-neutral-100">
            Analytics Platform
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
                if (!visible.chart) fetchData();
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
          </aside>

          {/* CENTER: chart mode หรือ analytics mode */}
          {mode === "chart" ? (
            <section className="flex-1 overflow-y-auto p-3">
              {visible.chart && data && data.timestamps.length > 0 ? (
                <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
                  <ChartCanvas
                    data={data}
                    interval={interval}
                    descriptions={descriptions}
                  />
                </div>
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
                  {visible.chart && (
                    <button
                      onClick={refreshChart}
                      disabled={busy}
                      title="Refresh chart with current tags"
                      className="text-neutral-500 hover:text-blue-400 disabled:opacity-50"
                    >
                      ↻
                    </button>
                  )}
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
                      <span className="flex-1 truncate">{tag}</span>
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
                            {t.tag}
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

            {data && Object.keys(data.series).length > 0 && (
              <div className="border-t border-neutral-800 pt-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  Summary
                </div>
                <div className="overflow-x-auto rounded border border-neutral-800 bg-neutral-900">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-neutral-500">
                        <th className="px-1.5 py-1 text-left font-medium"></th>
                        {Object.keys(data.series).map((tag) => (
                          <th
                            key={tag}
                            className="max-w-[70px] truncate px-1.5 py-1 text-right font-medium text-neutral-300"
                            title={descriptions[tag] || tag}
                          >
                            {descriptions[tag] || tag}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        ["count", "min", "max", "mean", "median", "std"] as const
                      ).map((metric) => (
                        <tr
                          key={metric}
                          className="border-t border-neutral-800/60 text-neutral-400"
                        >
                          <td className="px-1.5 py-0.5 font-medium capitalize text-neutral-500">
                            {metric}
                          </td>
                          {Object.values(data.series).map((vals, i) => {
                            const s = computeStats(vals);
                            return (
                              <td
                                key={i}
                                className="px-1.5 py-0.5 text-right tabular-nums"
                              >
                                {metric === "count"
                                  ? s.count
                                  : fmtNum(s[metric])}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </aside>
          )}
        </div>
      </div>

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
