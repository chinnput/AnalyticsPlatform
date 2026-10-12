"use client";

import { useState } from "react";
import { CLASS_PRESETS } from "@/lib/classPresets";
import { displayTag, type ClassDef, type SavedTag } from "@/lib/types";

type ClassType = ClassDef["type"];

// ฟอร์มเก็บตัวเลขเป็น string ให้พิมพ์ค้างได้ (เช่น "-" หรือ "1.") แล้วค่อยแปลงตอนบันทึก
interface Row {
  label: string;
  tag: string; // one-hot
  value: string; // one-hot: activeValue · value-map: value
  min: string; // range
  max: string; // range
}

interface Form {
  id: string; // "" = definition ใหม่
  name: string;
  type: ClassType;
  tag: string; // value-map / range
  noneLabel: string;
  tolerance: string;
  rows: Row[];
}

const TYPE_HELP: Record<ClassType, string> = {
  "one-hot": "หลาย tag — แต่ละ tag บอกว่า class ตัวเอง active ไหม (ค่า == activeValue)",
  "value-map": "tag เดียว — ค่าแต่ละค่าคือ class",
  range: "tag ต่อเนื่อง — แบ่งเป็นช่วง min ≤ ค่า < max (เว้นว่าง = ไม่จำกัด)",
};

const emptyRow = (): Row => ({ label: "", tag: "", value: "", min: "", max: "" });
const str = (v: number | null | undefined) => (v == null ? "" : String(v));

function toForm(def: ClassDef): Form {
  const base = {
    id: def.id,
    name: def.name,
    type: def.type,
    noneLabel: def.noneLabel ?? "",
    tolerance: str(def.tolerance),
  };
  if (def.type === "one-hot")
    return {
      ...base,
      tag: "",
      rows: def.classes.map((c) => ({ ...emptyRow(), label: c.label, tag: c.tag, value: str(c.activeValue) })),
    };
  if (def.type === "value-map")
    return {
      ...base,
      tag: def.tag,
      rows: def.map.map((m) => ({ ...emptyRow(), label: m.label, value: str(m.value) })),
    };
  return {
    ...base,
    tag: def.tag,
    rows: def.bins.map((b) => ({ ...emptyRow(), label: b.label, min: str(b.min), max: str(b.max) })),
  };
}

const newForm = (): Form => ({
  id: "",
  name: "",
  type: "one-hot",
  tag: "",
  noneLabel: "",
  tolerance: "",
  rows: [emptyRow(), emptyRow()],
});

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "class"
  );
}

const isNum = (s: string) => s.trim() !== "" && !Number.isNaN(Number(s));

// ตรวจฟอร์ม → ClassDef หรือข้อความ error
function fromForm(f: Form, existingIds: string[]): ClassDef | string {
  if (!f.name.trim()) return "ต้องมีชื่อ";
  const rows = f.rows.filter((r) => r.label.trim() || r.tag.trim() || r.value.trim() || r.min.trim() || r.max.trim());
  if (rows.length === 0) return "ต้องมีอย่างน้อย 1 class";
  const labels = rows.map((r) => r.label.trim());
  if (labels.some((l) => !l)) return "ทุกแถวต้องมี label";
  if (new Set(labels).size !== labels.length) return "label ห้ามซ้ำ";
  if (f.noneLabel.trim() && labels.includes(f.noneLabel.trim())) return "noneLabel ห้ามซ้ำกับ label";
  if (f.tolerance.trim() && !(isNum(f.tolerance) && Number(f.tolerance) > 0)) return "tolerance ต้องเป็นตัวเลข > 0";

  let id = f.id;
  if (!id) {
    const base = slugify(f.name);
    id = base;
    for (let i = 2; existingIds.includes(id); i++) id = `${base}-${i}`;
  }
  const base = {
    id,
    name: f.name.trim(),
    ...(f.noneLabel.trim() ? { noneLabel: f.noneLabel.trim() } : {}),
    ...(f.tolerance.trim() ? { tolerance: Number(f.tolerance) } : {}),
  };

  if (f.type === "one-hot") {
    for (const r of rows) {
      if (!r.tag.trim()) return `${r.label}: ต้องเลือก tag`;
      if (!isNum(r.value)) return `${r.label}: activeValue ต้องเป็นตัวเลข`;
    }
    return {
      ...base,
      type: "one-hot",
      classes: rows.map((r) => ({ label: r.label.trim(), tag: r.tag.trim(), activeValue: Number(r.value) })),
    };
  }

  if (!f.tag.trim()) return "ต้องเลือก tag";
  if (f.type === "value-map") {
    for (const r of rows) if (!isNum(r.value)) return `${r.label}: value ต้องเป็นตัวเลข`;
    const values = rows.map((r) => Number(r.value));
    if (new Set(values).size !== values.length) return "value ห้ามซ้ำ";
    return {
      ...base,
      type: "value-map",
      tag: f.tag.trim(),
      map: rows.map((r) => ({ value: Number(r.value), label: r.label.trim() })),
    };
  }

  // range
  const bins = [];
  for (const r of rows) {
    if (r.min.trim() && !isNum(r.min)) return `${r.label}: min ต้องเป็นตัวเลข`;
    if (r.max.trim() && !isNum(r.max)) return `${r.label}: max ต้องเป็นตัวเลข`;
    const min = r.min.trim() ? Number(r.min) : null;
    const max = r.max.trim() ? Number(r.max) : null;
    if (min != null && max != null && min >= max) return `${r.label}: min ต้องน้อยกว่า max`;
    bins.push({ label: r.label.trim(), min, max });
  }
  const sorted = [...bins].sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));
  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i - 1].max ?? Infinity) > (sorted[i].min ?? -Infinity))
      return `ช่วง ${sorted[i - 1].label} กับ ${sorted[i].label} ทับกัน`;
  }
  return { ...base, type: "range", tag: f.tag.trim(), bins };
}

const inputCls =
  "rounded border border-neutral-800 bg-black px-1.5 py-0.5 text-[11px] text-neutral-200 focus:border-blue-500 focus:outline-none";

export default function ClassDefEditor({
  defs,
  tags,
  usedIds,
  onSave,
  onClose,
}: {
  defs: ClassDef[];
  tags: SavedTag[]; // tag ของ project (ให้เลือกในช่อง tag)
  usedIds: string[]; // definition ที่ panel/chart ใช้อยู่ (เตือนก่อนลบ)
  onSave: (defs: ClassDef[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<ClassDef[]>(defs);
  const [form, setForm] = useState<Form | null>(defs[0] ? toForm(defs[0]) : null);
  const [error, setError] = useState("");
  const presets = CLASS_PRESETS.filter((p) => !list.some((d) => d.id === p.id));

  const setRow = (i: number, patch: Partial<Row>) =>
    form && setForm({ ...form, rows: form.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  function applyForm() {
    if (!form) return;
    const res = fromForm(form, list.map((d) => d.id));
    if (typeof res === "string") return setError(res);
    const next = list.some((d) => d.id === res.id)
      ? list.map((d) => (d.id === res.id ? res : d))
      : [...list, res];
    setList(next);
    setForm(toForm(res));
    setError("");
    onSave(next);
  }

  function remove(def: ClassDef) {
    const used = usedIds.includes(def.id);
    const warn = used ? "\nมี panel/chart ใช้อยู่ — จะกลับเป็น off" : "";
    if (!confirm(`ลบ "${def.name}"?${warn}`)) return;
    const next = list.filter((d) => d.id !== def.id);
    setList(next);
    setForm(next[0] ? toForm(next[0]) : null);
    onSave(next);
  }

  function addPreset(id: string) {
    const p = CLASS_PRESETS.find((x) => x.id === id);
    if (!p) return;
    const next = [...list, p];
    setList(next);
    setForm(toForm(p));
    onSave(next);
  }

  const duplicate = (def: ClassDef) =>
    setForm({ ...toForm(def), id: "", name: `${def.name} (copy)` });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="flex h-[80vh] w-[860px] max-w-[95vw] overflow-hidden rounded border border-neutral-700 bg-neutral-950 text-[11px] text-neutral-300"
        onClick={(e) => e.stopPropagation()}
      >
        <datalist id="project-tags">
          {tags.map((t) => (
            <option key={t.tag} value={t.tag}>
              {displayTag(t.tag)}
              {t.description && t.description !== displayTag(t.tag) ? ` — ${t.description}` : ""}
            </option>
          ))}
        </datalist>

        {/* รายการ definition */}
        <aside className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-neutral-800 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">Class definitions</div>
          {list.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setForm(toForm(d));
                setError("");
              }}
              className={`rounded px-2 py-1 text-left ${
                form?.id === d.id ? "bg-blue-600/20 text-blue-300" : "hover:bg-neutral-800"
              }`}
            >
              <div className="truncate">{d.name}</div>
              <div className="text-[9px] text-neutral-500">{d.type}</div>
            </button>
          ))}
          <button
            onClick={() => {
              setForm(newForm());
              setError("");
            }}
            className="mt-1 rounded border border-dashed border-neutral-700 px-2 py-1 text-neutral-400 hover:text-neutral-200"
          >
            + New
          </button>
          {presets.length > 0 && (
            <select className={`${inputCls} mt-1`} value="" onChange={(e) => addPreset(e.target.value)}>
              <option value="">+ จาก preset…</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </aside>

        {/* ฟอร์มแก้ไข */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
            <span className="text-[12px] font-semibold text-neutral-100">
              {form ? (form.id ? "Edit class definition" : "New class definition") : "Class Settings"}
            </span>
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
              ✕
            </button>
          </div>

          {!form ? (
            <div className="flex flex-1 items-center justify-center text-neutral-600">
              ยังไม่มี definition — กด + New หรือเลือกจาก preset
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-[90px_1fr] items-center gap-x-2 gap-y-1.5">
                <span className="text-neutral-500">Name</span>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <span className="text-neutral-500">Type</span>
                <div className="flex items-center gap-2">
                  <select
                    className={inputCls}
                    value={form.type}
                    disabled={!!form.id}
                    title={form.id ? "เปลี่ยน type ได้เฉพาะ definition ใหม่" : ""}
                    onChange={(e) => setForm({ ...form, type: e.target.value as ClassType })}
                  >
                    <option value="one-hot">one-hot</option>
                    <option value="value-map">value-map</option>
                    <option value="range">range</option>
                  </select>
                  <span className="text-[10px] text-neutral-500">{TYPE_HELP[form.type]}</span>
                </div>
                {form.type !== "one-hot" && (
                  <>
                    <span className="text-neutral-500">Tag</span>
                    <input
                      className={inputCls}
                      list="project-tags"
                      value={form.tag}
                      onChange={(e) => setForm({ ...form, tag: e.target.value })}
                      placeholder="เลือกหรือพิมพ์ tag"
                    />
                  </>
                )}
                <span className="text-neutral-500">noneLabel</span>
                <input
                  className={`${inputCls} w-32`}
                  value={form.noneLabel}
                  onChange={(e) => setForm({ ...form, noneLabel: e.target.value })}
                  placeholder="(ว่าง = NaN)"
                  title="จุดที่ไม่เข้า class ไหน — ถูกตัดทิ้งตอนวิเคราะห์"
                />
                {form.type !== "range" && (
                  <>
                    <span className="text-neutral-500">Tolerance</span>
                    <input
                      className={`${inputCls} w-32`}
                      value={form.tolerance}
                      onChange={(e) => setForm({ ...form, tolerance: e.target.value })}
                      placeholder="1e-6"
                      title="ค่าต่างจาก activeValue/value ได้ไม่เกินนี้ถึงจะนับว่าเท่ากัน"
                    />
                  </>
                )}
              </div>

              <table className="mt-3 w-full border-collapse">
                <thead>
                  <tr className="text-left text-[10px] text-neutral-500">
                    <th className="pb-1 font-medium">label</th>
                    {form.type === "one-hot" && <th className="pb-1 font-medium">tag</th>}
                    {form.type === "one-hot" && <th className="pb-1 font-medium">activeValue</th>}
                    {form.type === "value-map" && <th className="pb-1 font-medium">value</th>}
                    {form.type === "range" && <th className="pb-1 font-medium">min (≥)</th>}
                    {form.type === "range" && <th className="pb-1 font-medium">max (&lt;)</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {form.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="pr-1 pb-1">
                        <input className={`${inputCls} w-24`} value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                      </td>
                      {form.type === "one-hot" && (
                        <td className="pr-1 pb-1">
                          <input
                            className={`${inputCls} w-full`}
                            list="project-tags"
                            value={r.tag}
                            onChange={(e) => setRow(i, { tag: e.target.value })}
                          />
                        </td>
                      )}
                      {form.type !== "range" && (
                        <td className="pr-1 pb-1">
                          <input className={`${inputCls} w-20`} value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} />
                        </td>
                      )}
                      {form.type === "range" && (
                        <>
                          <td className="pr-1 pb-1">
                            <input className={`${inputCls} w-20`} value={r.min} onChange={(e) => setRow(i, { min: e.target.value })} placeholder="-∞" />
                          </td>
                          <td className="pr-1 pb-1">
                            <input className={`${inputCls} w-20`} value={r.max} onChange={(e) => setRow(i, { max: e.target.value })} placeholder="+∞" />
                          </td>
                        </>
                      )}
                      <td className="pb-1 text-right">
                        <button
                          onClick={() => setForm({ ...form, rows: form.rows.filter((_, j) => j !== i) })}
                          className="text-neutral-600 hover:text-red-400"
                          title="ลบแถว"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => setForm({ ...form, rows: [...form.rows, emptyRow()] })}
                className="mt-1 text-[10px] text-neutral-400 hover:text-neutral-200"
              >
                + เพิ่ม class
              </button>
            </div>
          )}

          {form && (
            <div className="flex items-center gap-2 border-t border-neutral-800 px-3 py-2">
              {error && <span className="text-amber-400">{error}</span>}
              {form.id && (
                <>
                  <button onClick={() => duplicate(list.find((d) => d.id === form.id)!)} className="text-neutral-400 hover:text-neutral-200">
                    Duplicate
                  </button>
                  <button onClick={() => remove(list.find((d) => d.id === form.id)!)} className="text-neutral-400 hover:text-red-400">
                    Delete
                  </button>
                </>
              )}
              <button onClick={applyForm} className="ml-auto rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-500">
                Save
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
