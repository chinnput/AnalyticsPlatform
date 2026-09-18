"use client";

import ReactECharts from "echarts-for-react";

export interface KdeCurve {
  tag: string;
  x: number[];
  y: number[];
}

export interface KdeData {
  curves: KdeCurve[];
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"];

export default function KdeCanvas({
  data,
  descriptions,
  height = 360,
}: {
  data: KdeData;
  descriptions?: Record<string, string>;
  height?: number | string;
}) {
  const label = (t: string) => descriptions?.[t] || t;

  const series = data.curves.map((c, i) => {
    const color = COLORS[i % COLORS.length];
    return {
      name: label(c.tag),
      type: "line",
      smooth: true,
      showSymbol: false,
      data: c.x.map((xv, j) => [xv, c.y[j]]),
      lineStyle: { width: 1.5, color },
      areaStyle: { color, opacity: 0.12 },
    };
  });

  const option = {
    backgroundColor: "transparent",
    textStyle: { color: "#a3a3a3", fontSize: 10 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#171717",
      borderColor: "#333",
      textStyle: { color: "#e5e5e5", fontSize: 10 },
      valueFormatter: (v: number) => (v == null ? "-" : v.toFixed(4)),
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
      name: "density",
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
