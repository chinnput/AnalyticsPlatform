"use client";

import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { displayTag } from "@/lib/types";

export interface HistogramSeries {
  tag: string;
  x: number[];
  y: number[];
}

export interface HistogramData {
  series: HistogramSeries[];
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"];

export default function HistogramCanvas({
  data,
  descriptions,
  height = 360,
}: {
  data: HistogramData;
  descriptions?: Record<string, string>;
  height?: number | string;
}) {
  const label = (t: string) => descriptions?.[t] || displayTag(t);
  const [xMin, setXMin] = useState("");
  const [xMax, setXMax] = useState("");
  const [yMax, setYMax] = useState("");
  const [showStats, setShowStats] = useState(true);
  // series ที่ถูกซ่อน (key = tag) — แทน legend ของ ECharts ที่ต้องเลื่อน
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (tag: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  const allVisible = hidden.size === 0;
  const toggleAll = () =>
    setHidden(allVisible ? new Set(data.series.map((h) => h.tag)) : new Set());

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const resetAxes = () => {
    setXMin("");
    setXMax("");
    setYMax("");
  };

  const stats = data.series.map((h, i) => {
    const total = h.y.reduce((s, v) => s + v, 0);
    if (total === 0)
      return {
        tag: h.tag,
        name: label(h.tag),
        color: COLORS[i % COLORS.length],
        count: 0,
        mean: null as number | null,
        median: null as number | null,
        std: null as number | null,
      };
    const mean = h.x.reduce((s, xv, j) => s + xv * h.y[j], 0) / total;
    const variance =
      h.x.reduce((s, xv, j) => s + h.y[j] * (xv - mean) ** 2, 0) / total;
    // median จาก cumulative count ของแต่ละ bin
    const half = total / 2;
    let cum = 0;
    let median = h.x[h.x.length - 1];
    for (let j = 0; j < h.x.length; j++) {
      cum += h.y[j];
      if (cum >= half) {
        median = h.x[j];
        break;
      }
    }
    return {
      tag: h.tag,
      name: label(h.tag),
      color: COLORS[i % COLORS.length],
      count: total,
      mean,
      median,
      std: Math.sqrt(variance),
    };
  });

  const fmt = (v: number | null) => (v == null ? "-" : v.toFixed(2));

  // กรอง series ที่ซ่อนออก แต่คงสีตาม index เดิม
  const series = data.series.flatMap((h, i) => {
    if (hidden.has(h.tag)) return [];
    const color = COLORS[i % COLORS.length];
    return {
      name: label(h.tag),
      type: "bar",
      // overlay: ทุก class วางทับตำแหน่ง bin เดียวกัน (ไม่เหลื่อม)
      barGap: "-100%",
      data: h.x.map((xv, j) => [xv, h.y[j]]),
      itemStyle: { color, opacity: 0.5 },
    };
  });

  const option = {
    backgroundColor: "transparent",
    textStyle: { color: "#a3a3a3", fontSize: 10 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#171717",
      borderColor: "#333",
      textStyle: { color: "#e5e5e5", fontSize: 10 },
    },
    legend: { show: false },
    grid: { left: 50, right: 20, top: 24, bottom: 55 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" },
      {
        type: "slider",
        xAxisIndex: 0,
        height: 14,
        bottom: 24,
        filterMode: "none",
        backgroundColor: "#171717",
        borderColor: "#333",
        fillerColor: "rgba(59,130,246,0.15)",
        handleStyle: { color: "#3b82f6" },
        textStyle: { color: "#737373", fontSize: 9 },
      },
    ],
    xAxis: {
      type: "value",
      name: "value",
      min: num(xMin),
      max: num(xMax),
      nameTextStyle: { color: "#737373", fontSize: 10 },
      axisLabel: {
        fontSize: 10,
        color: "#737373",
        formatter: (v: number) => v.toFixed(2),
      },
      axisLine: { lineStyle: { color: "#333" } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "count",
      min: 0,
      max: num(yMax),
      nameTextStyle: { color: "#737373", fontSize: 10 },
      axisLabel: { fontSize: 10, color: "#737373" },
      splitLine: { lineStyle: { color: "#ffffff", opacity: 0.07 } },
    },
    series,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 px-1 pb-1 text-[10px] text-neutral-500">
        <span>X</span>
        <input
          className="w-14 rounded border border-neutral-800 bg-black px-1 py-0.5 text-[10px] text-neutral-300 focus:border-blue-500 focus:outline-none"
          placeholder="min"
          value={xMin}
          onChange={(e) => setXMin(e.target.value)}
        />
        <input
          className="w-14 rounded border border-neutral-800 bg-black px-1 py-0.5 text-[10px] text-neutral-300 focus:border-blue-500 focus:outline-none"
          placeholder="max"
          value={xMax}
          onChange={(e) => setXMax(e.target.value)}
        />
        <span className="ml-2">Y</span>
        <input
          className="w-14 rounded border border-neutral-800 bg-black px-1 py-0.5 text-[10px] text-neutral-300 focus:border-blue-500 focus:outline-none"
          placeholder="max"
          value={yMax}
          onChange={(e) => setYMax(e.target.value)}
        />
        <button
          onClick={resetAxes}
          title="Reset axis range"
          className="ml-1 rounded border border-neutral-800 bg-neutral-800 px-1.5 py-0.5 text-[10px] leading-none text-neutral-300 hover:bg-neutral-700"
        >
          Reset
        </button>
        <button
          onClick={() => setShowStats((s) => !s)}
          title="Toggle stats box"
          className={`rounded border px-1.5 py-0.5 text-[10px] leading-none ${
            showStats
              ? "border-blue-600 bg-blue-600/20 text-blue-300"
              : "border-neutral-800 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          Stats
        </button>
        <span className="ml-auto text-neutral-600">scroll = zoom · drag = pan</span>
      </div>
      {data.series.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 px-1 pb-1 text-[10px]">
          <button
            onClick={toggleAll}
            title={allVisible ? "Hide all" : "Show all"}
            className="rounded border border-neutral-800 bg-neutral-800 px-1.5 py-0.5 leading-none text-neutral-300 hover:bg-neutral-700"
          >
            {allVisible ? "None" : "All"}
          </button>
          {data.series.map((h, i) => {
            const off = hidden.has(h.tag);
            return (
              <button
                key={h.tag}
                onClick={() => toggle(h.tag)}
                title={off ? "Show" : "Hide"}
                className={`flex items-center gap-1 rounded border border-neutral-800 px-1.5 py-0.5 leading-none hover:bg-neutral-800 ${
                  off ? "text-neutral-600 line-through" : "text-neutral-300"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{
                    backgroundColor: off ? "#404040" : COLORS[i % COLORS.length],
                  }}
                />
                <span className="max-w-[160px] truncate">{label(h.tag)}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ReactECharts
          option={option}
          style={{ height, width: "100%" }}
          notMerge
        />
      </div>
      {showStats && stats.length > 0 && (
        <div className="mt-1 overflow-auto border-t border-neutral-800 pt-1">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="text-neutral-500">
                <th className="px-1 text-left font-medium">series</th>
                <th className="px-1 text-right font-medium">n</th>
                <th className="px-1 text-right font-medium">mean</th>
                <th className="px-1 text-right font-medium">med</th>
                <th className="px-1 text-right font-medium">sd</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr
                  key={s.tag}
                  onClick={() => toggle(s.tag)}
                  title="Click to show/hide"
                  className={`cursor-pointer hover:bg-neutral-900 ${
                    hidden.has(s.tag) ? "text-neutral-600" : "text-neutral-300"
                  }`}
                >
                  <td className="px-1">
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="max-w-[140px] truncate">{s.name}</span>
                    </span>
                  </td>
                  <td className="px-1 text-right tabular-nums">{s.count}</td>
                  <td className="px-1 text-right tabular-nums">{fmt(s.mean)}</td>
                  <td className="px-1 text-right tabular-nums">
                    {fmt(s.median)}
                  </td>
                  <td className="px-1 text-right tabular-nums">{fmt(s.std)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
