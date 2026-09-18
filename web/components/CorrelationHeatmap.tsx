"use client";

import ReactECharts from "echarts-for-react";

export interface CorrelationData {
  tags: string[];
  matrix: (number | null)[][];
}

export default function CorrelationHeatmap({
  data,
  height = 360,
}: {
  data: CorrelationData;
  height?: number | string;
}) {
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
        return `${data.tags[y]} × ${data.tags[x]}<br/>r = ${v}`;
      },
    },
    grid: { left: 120, right: 20, top: 20, bottom: 100 },
    xAxis: {
      type: "category",
      data: data.tags,
      axisLabel: { fontSize: 10, color: "#737373", rotate: 45 },
      splitArea: { show: true },
    },
    yAxis: {
      type: "category",
      data: data.tags,
      axisLabel: { fontSize: 10, color: "#737373" },
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
