"use client";

import { useEffect, useState } from "react";
import type { ProjectSummary, TrashedProject } from "@/lib/types";

const fmtDate = (iso: string) => new Date(iso).toLocaleString();

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [trash, setTrash] = useState<TrashedProject[]>([]);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const json = await res.json();
      setProjects(json.projects ?? []);
      setTrash(json.trash ?? []);
    } catch {
      setMsg("โหลด project ไม่ได้");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "สร้างไม่สำเร็จ");
    window.location.href = `/chart?project=${json.id}`;
  }

  async function rename() {
    if (!renaming || !renaming.name.trim()) return;
    await fetch(`/api/projects/${renaming.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renaming.name }),
    });
    setRenaming(null);
    load();
  }

  async function remove(p: ProjectSummary) {
    if (!confirm(`ย้าย "${p.name}" ลงถังขยะ? (กู้คืนได้ภายใน 7 วัน)`)) return;
    await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    load();
  }

  async function restore(t: TrashedProject) {
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: t.file }),
    });
    load();
  }

  return (
    <main className="min-h-screen bg-black text-[12px] text-neutral-300">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold text-neutral-100">Projects</h1>
          <a href="/" className="text-[11px] text-neutral-500 hover:text-neutral-300">
            ← Home
          </a>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[12px] text-neutral-200 focus:border-blue-500 focus:outline-none"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="New project name"
          />
          <button
            onClick={create}
            className="rounded bg-blue-600 px-3 text-[12px] font-medium text-white hover:bg-blue-500"
          >
            + Create
          </button>
        </div>
        {msg && <p className="mt-2 text-[11px] text-amber-400">{msg}</p>}

        <div className="mt-6 flex flex-col gap-2">
          {projects.length === 0 && (
            <p className="rounded border border-dashed border-neutral-800 p-6 text-center text-neutral-600">
              ยังไม่มี project — สร้างใหม่ด้านบน
            </p>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-950 px-3 py-2"
            >
              {renaming?.id === p.id ? (
                <input
                  autoFocus
                  className="flex-1 rounded border border-neutral-700 bg-black px-2 py-1 text-neutral-200"
                  value={renaming.name}
                  onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={rename}
                />
              ) : (
                <a href={`/chart?project=${p.id}`} className="flex-1 hover:text-blue-400">
                  <div className="font-medium text-neutral-100">{p.name}</div>
                  <div className="text-[10px] text-neutral-500">
                    {p.tagCount} tags · updated {fmtDate(p.updatedAt)}
                  </div>
                </a>
              )}
              <button
                onClick={() => setRenaming({ id: p.id, name: p.name })}
                className="text-[11px] text-neutral-500 hover:text-neutral-200"
              >
                Rename
              </button>
              <button
                onClick={() => remove(p)}
                className="text-[11px] text-neutral-500 hover:text-red-400"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        {trash.length > 0 && (
          <div className="mt-8">
            <div className="mb-2 text-[10px] uppercase tracking-wide text-neutral-500">
              Trash (ลบถาวรเมื่อเกิน 7 วัน)
            </div>
            <div className="flex flex-col gap-1">
              {trash.map((t) => (
                <div
                  key={t.file}
                  className="flex items-center gap-3 rounded border border-neutral-900 px-3 py-1.5 text-neutral-500"
                >
                  <span className="flex-1">{t.name}</span>
                  <span className="text-[10px]">ลบถาวร {fmtDate(t.purgeAt)}</span>
                  <button
                    onClick={() => restore(t)}
                    className="text-[11px] text-neutral-400 hover:text-emerald-400"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
