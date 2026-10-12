"use client";

import { useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import type EChartsReactCore from "echarts-for-react/lib/core";
import { displayTag } from "@/lib/types";

export interface ChartData {
  timestamps: string[];
  series: Record<string, (number | null)[]>;
}

export type DrawMode = "none" | "hline" | "vline";

export interface Annotation {
  id: string;
  kind: "hline" | "vline";
  value: number; // hline = ค่า Y, vline = index ของแกน X
  text?: string;
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

export type ScaleMode = "single" | "multiple" | "range";

const AXIS_COLORS = [
  "#60a5fa",
  "#f472b6",
  "#4ade80",
  "#fbbf24",
  "#a78bfa",
  "#22d3ee",
];

// ---- แถบสีพื้นหลังตาม class ----
export const CLASS_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4"];

export interface ClassBand {
  label: string;
  start: number; // index ของ timestamp
  end: number;
}

// classes[i] = class ของ timestamp i (null = ไม่อยู่ใน class ที่เลือก) → ช่วงต่อเนื่องของ class เดียวกัน
export function bandsFromClasses(classes: (string | null)[]): ClassBand[] {
  const bands: ClassBand[] = [];
  classes.forEach((c, i) => {
    const last = bands[bands.length - 1];
    if (c == null) return;
    if (last && last.label === c && last.end === i - 1) last.end = i;
    else bands.push({ label: c, start: i, end: i });
  });
  return bands;
}

// ค่าล่าสุดที่ไม่ใช่ null ของ series
function lastValue(vals: (number | null)[]): number | null {
  for (let i = vals.length - 1; i >= 0; i--) {
    const v = vals[i];
    if (v != null && !Number.isNaN(v)) return v;
  }
  return null;
}

export default function ChartCanvas({
  data,
  interval = "1h",
  descriptions = {},
  scaleMode = "multiple",
  scaleMin,
  scaleMax,
  drawMode = "none",
  annotations = [],
  onPlaceAnnotation,
  classBands = [],
  classOrder = [],
}: {
  classBands?: ClassBand[];
  classOrder?: string[]; // ลำดับ class → กำหนดสี
  data: ChartData;
  interval?: string;
  descriptions?: Record<string, string>;
  scaleMode?: ScaleMode;
  scaleMin?: number;
  scaleMax?: number;
  drawMode?: DrawMode;
  annotations?: Annotation[];
  onPlaceAnnotation?: (a: { kind: "hline" | "vline"; value: number }) => void;
}) {
  const chartRef = useRef<EChartsReactCore>(null);
  // ใช้ ref เก็บ drawMode + callback ล่าสุด กัน closure ของ zr click ค้างค่าเก่า
  const drawModeRef = useRef(drawMode);
  const placeRef = useRef(onPlaceAnnotation);
  useEffect(() => {
    drawModeRef.current = drawMode;
    placeRef.current = onPlaceAnnotation;
  }, [drawMode, onPlaceAnnotation]);

  const seriesNames = Object.keys(data.series);
  const label = (name: string) => descriptions[name] || displayTag(name);

  // โชว์ป้ายเวลาแค่ ~8 ป้าย ไม่ว่าจะมีกี่จุด (ลดความถี่แกน X)
  const labelStep = Math.max(0, Math.ceil(data.timestamps.length / 8) - 1);

  // multiple = แกน Y แยกทุก tag, single/range = แกนเดียว
  const multi = scaleMode === "multiple" && seriesNames.length > 1;

  const baseYAxis = (offset = 0, color?: string) => ({
    type: "value" as const,
    scale: scaleMode !== "range",
    min: scaleMode === "range" ? scaleMin : undefined,
    max: scaleMode === "range" ? scaleMax : undefined,
    position: offset % 2 === 0 ? ("left" as const) : ("right" as const),
    offset: Math.floor(offset / 2) * 42,
    axisLabel: {
      fontSize: 10,
      color: color ?? "#737373",
      formatter: (value: number) => Number(value).toFixed(2),
    },
    axisLine: color ? { show: true, lineStyle: { color } } : undefined,
    splitLine:
      offset === 0
        ? { lineStyle: { color: "#ffffff", opacity: 0.07 } }
        : { show: false },
  });

  const yAxis = multi
    ? seriesNames.map((_, i) => baseYAxis(i, AXIS_COLORS[i % AXIS_COLORS.length]))
    : baseYAxis(0);

  // เว้นระยะซ้าย/ขวาให้พอกับจำนวนแกนเมื่อเป็น multiple
  const leftAxes = multi ? Math.ceil(seriesNames.length / 2) : 1;
  const rightAxes = multi ? Math.floor(seriesNames.length / 2) : 0;
  const gridLeft = 50 + Math.max(0, leftAxes - 1) * 42;
  const gridRight = 20 + rightAxes * 42;

  const classColor = (c: string) =>
    CLASS_COLORS[Math.max(0, classOrder.indexOf(c)) % CLASS_COLORS.length];
  const markArea =
    classBands.length > 0
      ? {
          silent: true,
          data: classBands.map((b) => [
            {
              xAxis: data.timestamps[b.start],
              itemStyle: { color: classColor(b.label), opacity: 0.12 },
            },
            // ครอบถึงจุดถัดไป ไม่งั้นช่วงที่มีจุดเดียวจะกว้าง 0
            { xAxis: data.timestamps[Math.min(b.end + 1, data.timestamps.length - 1)] },
          ]),
        }
      : undefined;

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
      data: seriesNames.map(label),
      top: 0,
      icon: "line",
      itemWidth: 18,
      itemHeight: 2,
      textStyle: { color: "#a3a3a3", fontSize: 10 },
    },
    grid: { left: gridLeft, right: gridRight, top: 30, bottom: 30 },
    xAxis: {
      type: "category",
      data: data.timestamps,
      boundaryGap: false,
      axisLabel: {
        fontSize: 10,
        color: "#737373",
        interval: labelStep,
        hideOverlap: true,
        formatter: (value: string) => formatAxisTime(value, interval),
      },
      axisLine: { lineStyle: { color: "#333" } },
    },
    yAxis,
    // ปิด zoom ตอนวาด ไม่งั้นคลิกแล้วซูมแทน
    dataZoom: [{ type: "inside", start: 0, end: 100, disabled: drawMode !== "none" }],
    series: seriesNames.map((name, i) => {
      const color =
        seriesNames.length > 1
          ? AXIS_COLORS[i % AXIS_COLORS.length]
          : "#60a5fa";
      const lastVal = lastValue(data.series[name]);

      // markLine ต่อ series: ค่าล่าสุด (label ติดแกน Y) + annotations (เฉพาะ series แรก)
      const mlData: Record<string, unknown>[] = [];
      if (lastVal != null) {
        mlData.push({
          yAxis: lastVal,
          _last: true,
          lineStyle: { color, width: 1, type: "solid", opacity: 0.5 },
          label: {
            show: true,
            position: "start",
            color: "#000",
            backgroundColor: color,
            padding: [2, 4, 2, 4],
            borderRadius: 2,
            formatter: () => Number(lastVal).toFixed(2),
          },
        });
      }
      if (i === 0) {
        for (const a of annotations) {
          mlData.push(
            a.kind === "hline"
              ? { yAxis: a.value, annText: a.text, name: a.id }
              : { xAxis: a.value, annText: a.text, name: a.id },
          );
        }
      }
      const markLine =
        mlData.length > 0
          ? {
              silent: true,
              symbol: "none",
              label: {
                position: "middle",
                fontSize: 10,
                color: "#e5e5e5",
                formatter: (p: { data: { annText?: string } }) =>
                  p.data.annText || "",
              },
              lineStyle: { color: "#f59e0b", width: 1, type: "dashed" },
              data: mlData,
            }
          : undefined;
      return {
        name: label(name),
        type: "line",
        yAxisIndex: multi ? i : 0,
        data: data.series[name].map((v) => (v == null ? null : Number(v))),
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1.5, color },
        itemStyle: { color },
        ...(markLine ? { markLine } : {}),
        ...(i === 0 && markArea ? { markArea } : {}),
      };
    }),
  };

  // คลิกที่ไหนก็ได้บนพื้นที่กราฟ แล้วแปลง pixel -> ค่าข้อมูลเพื่อวางเส้น
  function handleZrClick(e: { offsetX: number; offsetY: number }) {
    const mode = drawModeRef.current;
    const place = placeRef.current;
    if (mode === "none" || !place) return;
    const inst = chartRef.current?.getEchartsInstance();
    if (!inst) return;
    const pt: [number, number] = [e.offsetX, e.offsetY];
    if (!inst.containPixel("grid", pt)) return;
    const [xIdx, yVal] = inst.convertFromPixel({ gridIndex: 0 }, pt) as [
      number,
      number,
    ];
    if (mode === "hline") {
      place({ kind: "hline", value: Number(yVal.toFixed(4)) });
    } else if (mode === "vline") {
      place({ kind: "vline", value: Math.round(xIdx) });
    }
  }

  return (
    <>
    {classBands.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 px-1 text-[10px] text-neutral-400">
        {classOrder.map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ backgroundColor: classColor(c), opacity: 0.6 }}
            />
            {c}
          </span>
        ))}
      </div>
    )}
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{
        height: 460,
        width: "100%",
        cursor: drawMode === "none" ? "default" : "crosshair",
      }}
      notMerge
      onChartReady={(inst: {
        getZr: () => { on: (ev: string, cb: (e: unknown) => void) => void };
      }) => {
        inst.getZr().on("click", (ev) =>
          handleZrClick(ev as { offsetX: number; offsetY: number }),
        );
      }}
    />
    </>
  );
}
