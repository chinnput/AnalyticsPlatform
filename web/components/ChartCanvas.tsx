"use client";

import ReactECharts from "echarts-for-react";

export interface ChartData {
  timestamps: string[];
  series: Record<string, (number | null)[]>;
}

const pad = (n: number) => String(n).padStart(2, "0");

function formatAxisTime(iso: string, interval: string): string {
  const d = new Date(iso);
  if (interval === "1d") return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTooltipTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ChartCanvas({
  data,
  interval = "1h",
}: {
  data: ChartData;
  interval?: string;
}) {
  const seriesNames = Object.keys(data.series);

  const option = {
    backgroundColor: "transparent",
    textStyle: { color: "#a3a3a3", fontSize: 10 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", label: { fontSize: 10 } },
      backgroundColor: "#171717",
      borderColor: "#333",
      textStyle: { color: "#e5e5e5", fontSize: 10 },
      formatter: (params: { axisValue: string; marker: string; seriesName: string; value: number | null }[]) => {
        if (!params.length) return "";
        const header = formatTooltipTime(params[0].axisValue);
        const rows = params
          .map((p) => {
            const v = p.value == null ? "-" : Number(p.value).toFixed(2);
            return `${p.marker}${p.seriesName}: ${v}`;
          })
          .join("<br/>");
        return `${header}<br/>${rows}`;
      },
    },
    legend: {
      data: seriesNames,
      top: 0,
      textStyle: { color: "#a3a3a3", fontSize: 10 },
    },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: "category",
      data: data.timestamps,
      boundaryGap: false,
      axisLabel: {
        fontSize: 10,
        color: "#737373",
        formatter: (value: string) => formatAxisTime(value, interval),
      },
      axisLine: { lineStyle: { color: "#333" } },
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: {
        fontSize: 10,
        color: "#737373",
        formatter: (value: number) => value.toFixed(2),
      },
      splitLine: { lineStyle: { color: "#ffffff", opacity: 0.07 } },
    },
    dataZoom: [{ type: "inside", start: 0, end: 100 }],
    series: seriesNames.map((name) => ({
      name,
      type: "line",
      data: data.series[name],
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 1.5 },
    })),
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 460, width: "100%" }}
      notMerge
    />
  );
}
