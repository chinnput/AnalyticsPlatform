"use client";

import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { displayTag } from "@/lib/types";

export interface ClusterPoint {
  x: number;
  y: number;
  cluster: number;
  cls?: string; // class ของจุด (เมื่อแบ่ง class แบบ split)
}

export interface ClusterData {
  xTag: string;
  yTag: string;
  k: number;
  points: ClusterPoint[];
  // ตาราง cluster × class: rows[i].counts[j] = จำนวนจุดของ cluster i ที่อยู่ใน class j
  crosstab?: { classes: string[]; rows: { cluster: number; counts: number[] }[] };
}

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#06b6d4",
];

export default function ClusterCanvas({
  data,
  descriptions,
  height = 380,
}: {
  data: ClusterData;
  descriptions?: Record<string, string>;
  height?: number | string;
}) {
  const label = (t: string) => descriptions?.[t] || displayTag(t);
  const ct = data.crosstab;
  const [colorBy, setColorBy] = useState<"cluster" | "class">("cluster");
  const byClass = colorBy === "class" && !!ct;

  const groups = byClass
    ? ct.classes.map((c) => ({
        name: c,
        pts: data.points.filter((p) => p.cls === c),
      }))
    : Array.from({ length: data.k }, (_, c) => ({
        name: `Cluster ${c + 1}`,
        pts: data.points.filter((p) => p.cluster === c),
      }));

  const series = groups.map((g, i) => ({
    name: g.name,
    type: "scatter",
    symbolSize: 7,
    data: g.pts.map((p) => [p.x, p.y]),
    itemStyle: { color: COLORS[i % COLORS.length], opacity: 0.75 },
  }));

  const option = {
    backgroundColor: "transparent",
    textStyle: { color: "#a3a3a3", fontSize: 10 },
    tooltip: {
      trigger: "item",
      backgroundColor: "#171717",
      borderColor: "#333",
      textStyle: { color: "#e5e5e5", fontSize: 10 },
    },
    legend: {
      textStyle: { color: "#a3a3a3", fontSize: 10 },
      top: 0,
    },
    grid: { left: 55, right: 20, top: 40, bottom: 50 },
    xAxis: {
      type: "value",
      name: label(data.xTag),
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: "#737373", fontSize: 10 },
      scale: true,
      axisLabel: {
        fontSize: 10,
        color: "#737373",
        formatter: (v: number) => v.toFixed(1),
      },
      axisLine: { lineStyle: { color: "#333" } },
      splitLine: { lineStyle: { color: "#ffffff", opacity: 0.07 } },
    },
    yAxis: {
      type: "value",
      name: label(data.yTag),
      nameTextStyle: { color: "#737373", fontSize: 10 },
      scale: true,
      axisLabel: {
        fontSize: 10,
        color: "#737373",
        formatter: (v: number) => v.toFixed(1),
      },
      splitLine: { lineStyle: { color: "#ffffff", opacity: 0.07 } },
    },
    series,
  };

  if (!ct) {
    return (
      <ReactECharts option={option} style={{ height, width: "100%" }} notMerge />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 px-1 pb-1 text-[10px] text-neutral-500">
        <span>สีตาม</span>
        {(["cluster", "class"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setColorBy(m)}
            className={`rounded border px-1.5 py-0.5 leading-none ${
              colorBy === m
                ? "border-blue-600 bg-blue-600/20 text-blue-300"
                : "border-neutral-800 text-neutral-400 hover:bg-neutral-800"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <ReactECharts option={option} style={{ height: "100%", width: "100%" }} notMerge />
      </div>
      {/* แต่ละ cluster มีจุดจาก class ไหนกี่ % — ถ้าปนกันเท่าๆ กัน แปลว่า k-means ไม่ได้แยกตาม class */}
      <table className="mt-1 w-full border-collapse border-t border-neutral-800 text-[10px]">
        <thead>
          <tr className="text-neutral-500">
            <th className="px-1 text-left font-medium">cluster \ class</th>
            {ct.classes.map((c) => (
              <th key={c} className="px-1 text-right font-medium">
                {c}
              </th>
            ))}
            <th className="px-1 text-right font-medium">n</th>
          </tr>
        </thead>
        <tbody>
          {ct.rows.map((r) => {
            const n = r.counts.reduce((a, b) => a + b, 0);
            return (
              <tr key={r.cluster} className="text-neutral-300">
                <td className="px-1">Cluster {r.cluster + 1}</td>
                {r.counts.map((v, j) => (
                  <td key={j} className="px-1 text-right tabular-nums">
                    {v}{" "}
                    <span className="text-neutral-600">
                      ({n ? Math.round((v / n) * 100) : 0}%)
                    </span>
                  </td>
                ))}
                <td className="px-1 text-right tabular-nums">{n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
