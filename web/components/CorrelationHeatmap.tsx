"use client";

import ReactECharts from "echarts-for-react";

export interface CorrelationData {
  tags?: string[];
  xTags?: string[];
  yTags?: string[];
  matrix: (number | null)[][];
}

export default function CorrelationHeatmap({
  data,
  height = 360,
  label,
}: {
  data: CorrelationData;
  height?: number | string;
  label?: (t: string) => string;
}) {
  const xTags = data.xTags ?? data.tags ?? [];
  const yTags = data.yTags ?? data.tags ?? [];
  const fmt = (t: string) => (label ? label(t) : t);
  // ตัดชื่อยาวบนแกน เก็บ 22 ตัวท้าย (ชื่อเต็มดูใน tooltip)
  const short = (t: string) => {
    const s = fmt(t);
    return s.length > 22 ? "…" + s.slice(-21) : s;
  };

  const points: [number, number, number | string][] = [];
  data.matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      points.push([x, y, v == null ? "-" : v]);
    });
  });

  const option = {
    backgroundColor: "transparent",
    textStyle: { color: "#a3a3a3", fontSize: 10 },
    tooltip: {
      position: "top",
      backgroundColor: "#171717",
      borderColor: "#333",
      textStyle: { color: "#e5e5e5", fontSize: 10 },
      formatter: (p: { data: [number, number, number | string] }) => {
        const [x, y, v] = p.data;
        return `${fmt(yTags[y])} × ${fmt(xTags[x])}<br/>r = ${v}`;
      },
    },
    grid: { left: 120, right: 20, top: 20, bottom: 100 },
    xAxis: {
      type: "category",
      data: xTags,
      axisLabel: {
        fontSize: 10,
        color: "#737373",
        rotate: 45,
        formatter: (t: string) => short(t),
      },
      splitArea: { show: true },
    },
    yAxis: {
      type: "category",
      data: yTags,
      axisLabel: {
        fontSize: 10,
        color: "#737373",
        formatter: (t: string) => short(t),
      },
      splitArea: { show: true },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 10,
      textStyle: { color: "#a3a3a3", fontSize: 9 },
      inRange: {
        color: ["#3b82f6", "#0a0a0a", "#ef4444"],
      },
    },
    series: [
      {
        type: "heatmap",
        data: points,
        label: {
          show: true,
          fontSize: 9,
          color: "#e5e5e5",
        },
        emphasis: { itemStyle: { borderColor: "#fff", borderWidth: 1 } },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      notMerge
    />
  );
}
