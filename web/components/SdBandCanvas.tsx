"use client";

import ReactECharts from "echarts-for-react";

export interface SdSeries {
  tag: string;
  mean: number;
  std: number;
  upper1: number;
  lower1: number;
  upper2: number;
  lower2: number;
  values: (number | null)[];
}

export interface SdData {
  timestamps: string[];
  series: SdSeries[];
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"];

export default function SdBandCanvas({
  data,
  descriptions,
  height = 380,
}: {
  data: SdData;
  descriptions?: Record<string, string>;
  height?: number | string;
}) {
  const label = (t: string) => descriptions?.[t] || t;

  const series = data.series.flatMap((s, i) => {
    const c = COLORS[i % COLORS.length];
    const line = (y: number) =>
      data.timestamps.map(() => y);
    return [
      {
        name: label(s.tag),
        type: "line",
        data: s.values,
        showSymbol: false,
        lineStyle: { width: 1.5, color: c },
        itemStyle: { color: c },
      },
      {
        name: `${label(s.tag)} +2σ`,
        type: "line",
        data: line(s.upper2),
        showSymbol: false,
        lineStyle: { width: 1, type: "dashed", color: c, opacity: 0.5 },
      },
      {
        name: `${label(s.tag)} -2σ`,
        type: "line",
        data: line(s.lower2),
        showSymbol: false,
        lineStyle: { width: 1, type: "dashed", color: c, opacity: 0.5 },
      },
      {
        name: `${label(s.tag)} mean`,
        type: "line",
        data: line(s.mean),
        showSymbol: false,
        lineStyle: { width: 1, type: "dotted", color: c, opacity: 0.7 },
      },
    ];
  });

  const option = {
    backgroundColor: "transparent",
    textStyle: { color: "#a3a3a3", fontSize: 10 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#171717",
      borderColor: "#333",
      textStyle: { color: "#e5e5e5", fontSize: 10 },
    },
    legend: {
      type: "scroll",
      textStyle: { color: "#a3a3a3", fontSize: 10 },
      icon: "line",
      itemWidth: 18,
      itemHeight: 2,
      top: 0,
    },
    grid: { left: 50, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: "category",
      data: data.timestamps,
      axisLabel: { fontSize: 9, color: "#737373", show: false },
      axisLine: { lineStyle: { color: "#333" } },
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: {
        fontSize: 10,
        color: "#737373",
        formatter: (v: number) => v.toFixed(2),
      },
      splitLine: { lineStyle: { color: "#ffffff", opacity: 0.07 } },
    },
    series,
  };

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      notMerge
    />
  );
}
