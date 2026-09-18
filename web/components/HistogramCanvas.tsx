"use client";

import ReactECharts from "echarts-for-react";

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
  const label = (t: string) => descriptions?.[t] || t;

  const series = data.series.map((h, i) => {
    const color = COLORS[i % COLORS.length];
    return {
      name: label(h.tag),
      type: "bar",
      barGap: "-30%",
      data: h.x.map((xv, j) => [xv, h.y[j]]),
      itemStyle: { color, opacity: 0.7 },
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
    legend: {
      type: "scroll",
      textStyle: { color: "#a3a3a3", fontSize: 10 },
      top: 0,
    },
    grid: { left: 50, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: "value",
      name: "value",
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
      nameTextStyle: { color: "#737373", fontSize: 10 },
      axisLabel: { fontSize: 10, color: "#737373" },
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
