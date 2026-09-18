"use client";

import ReactECharts from "echarts-for-react";

export interface BoxplotData {
  tags: string[];
  boxes: number[][];
  outliers: { index: number; value: number }[];
}

export default function BoxplotCanvas({
  data,
  height = 360,
}: {
  data: BoxplotData;
  height?: number | string;
}) {
  const option = {
    backgroundColor: "transparent",
    textStyle: { color: "#a3a3a3", fontSize: 10 },
    tooltip: {
      trigger: "item",
      backgroundColor: "#171717",
      borderColor: "#333",
      textStyle: { color: "#e5e5e5", fontSize: 10 },
    },
    grid: { left: 50, right: 20, top: 20, bottom: 60 },
    xAxis: {
      type: "category",
      data: data.tags,
      axisLabel: { fontSize: 10, color: "#737373", rotate: 20 },
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
    series: [
      {
        name: "boxplot",
        type: "boxplot",
        data: data.boxes,
        itemStyle: { color: "rgba(59,130,246,0.25)", borderColor: "#3b82f6" },
      },
      {
        name: "outlier",
        type: "scatter",
        data: data.outliers.map((o) => [o.index, o.value]),
        symbolSize: 5,
        itemStyle: { color: "#ef4444" },
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
