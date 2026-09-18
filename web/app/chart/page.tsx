"use client";

import { useState } from "react";
import ChartCanvas, { ChartData } from "@/components/ChartCanvas";

type RangePreset = "1D" | "1W" | "1M" | "custom";

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function rangeFromPreset(preset: RangePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  if (preset === "1D") start.setDate(end.getDate() - 1);
  else if (preset === "1W") start.setDate(end.getDate() - 7);
  else if (preset === "1M") start.setMonth(end.getMonth() - 1);
  return { start: fmt(start), end: fmt(end) };
}

export default function ChartPage() {
  const [tagInput, setTagInput] = useState("PULP-LINE2-KAPPA-PRESS1");
  const [preset, setPreset] = useState<RangePreset>("1D");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [interval, setInterval] = useState("1h");
  const [data, setData] = useState<ChartData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchData() {
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) {
      setMessage("Enter at least one tag");
      return;
    }

    let start: string;
    let end: string;
    if (preset === "custom") {
      if (!customStart || !customEnd) {
        setMessage("Select a custom time range");
        return;
      }
      start = customStart.replace("T", " ") + ":00";
      end = customEnd.replace("T", " ") + ":00";
    } else {
      ({ start, end } = rangeFromPreset(preset));
    }

    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "pi", tags, start, end, interval }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.detail || json.error || "Failed to load data");
        setData(null);
      } else {
        setData({ timestamps: json.timestamps, series: json.series });
        setMessage(`${json.meta?.rows ?? 0} points`);
      }
    } catch {
      setMessage("Service unreachable");
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-neutral-300">
      <div className="mx-auto max-w-6xl p-4 space-y-3">
        <h1 className="text-sm font-semibold text-neutral-100">
          PI Server Chart
        </h1>

        <div className="flex flex-wrap items-end gap-2 rounded border border-neutral-800 bg-neutral-950 p-2">
          <label className="flex flex-1 min-w-[200px] flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">
              Tags
            </span>
            <input
              className="input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="TAG1, TAG2"
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">
              Time
            </span>
            <select
              className="input"
              value={preset}
              onChange={(e) => setPreset(e.target.value as RangePreset)}
            >
              <option value="1D">1 Day</option>
              <option value="1W">1 Week</option>
              <option value="1M">1 Month</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">
              Interval
            </span>
            <select
              className="input"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="1d">1d</option>
            </select>
          </label>

          {preset === "custom" && (
            <>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  Start
                </span>
                <input
                  className="input"
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  End
                </span>
                <input
                  className="input"
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </label>
            </>
          )}

          <button
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            onClick={fetchData}
            disabled={busy}
          >
            {busy ? "Loading..." : "Load"}
          </button>

          {message && (
            <span className="text-[10px] text-neutral-500">{message}</span>
          )}
        </div>

        {data && data.timestamps.length > 0 && (
          <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
            <ChartCanvas data={data} interval={interval} />
          </div>
        )}
      </div>

      <style jsx>{`
        .input {
          background: #0a0a0a;
          border: 1px solid #262626;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          color: #e5e5e5;
        }
        .input:focus {
          outline: none;
          border-color: #3b82f6;
        }
      `}</style>
    </main>
  );
}
