"use client";

import ReactECharts from "echarts-for-react";

export interface ClusterPoint {
  x: number;
  y: number;
  cluster: number;
}

export interface ClusterData {
  xTag: string;
  yTag: string;
  k: number;
  points: ClusterPoint[];
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
  const label = (t: string) => descriptions?.[t] || t;

  const series = Array.from({ length: data.k }, (_, c) => ({
    name: `Cluster ${c + 1}`,
    type: "scatter",
    symbolSize: 7,
    data: data.points
      .filter((p) => p.cluster === c)
      .map((p) => [p.x, p.y]),
    itemStyle: { color: COLORS[c % COLORS.length], opacity: 0.75 },
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

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      notMerge
    />
  );
}
