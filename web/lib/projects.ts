import { promises as fs } from "fs";
import path from "path";
import type { Project, ProjectSummary, SavedTag, TrashedProject } from "./types";

// เก็บ project เป็นไฟล์ JSON: web/data/projects/<id>.json (+ โฟลเดอร์ <id>/files/ สำหรับไฟล์ที่อัปโหลด)
// ลบ = ย้ายไป _trash/<id>__<deletedAt>.json (+ โฟลเดอร์ <id>__<deletedAt>/) แล้วลบทิ้งจริงเมื่อเกิน TRASH_DAYS
const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const TRASH_DIR = path.join(PROJECTS_DIR, "_trash");
const LEGACY_TAGS = path.join(DATA_DIR, "saved_tags.json");
const TRASH_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const ID_RE = /^[a-z0-9-]+$/;

function projectFile(id: string) {
  if (!ID_RE.test(id)) throw new Error("invalid project id");
  return path.join(PROJECTS_DIR, `${id}.json`);
}

// โฟลเดอร์ข้อมูลของ project (ไฟล์ที่อัปโหลดอยู่ใน <dir>/files/)
export function projectDir(id: string) {
  if (!ID_RE.test(id)) throw new Error("invalid project id");
  return path.join(PROJECTS_DIR, id);
}

export function slugify(name: string) {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "project";
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function newProject(id: string, name: string, tags: SavedTag[] = []): Project {
  const now = new Date().toISOString();
  const groups = Array.from(
    new Set(tags.map((t) => t.group?.trim()).filter((g): g is string => !!g)),
  );
  return { id, name, createdAt: now, updatedAt: now, tags, groups, classDefs: [], files: [], settings: {} };
}

// ครั้งแรกที่ยังไม่มีโฟลเดอร์ projects: ย้าย saved_tags.json เดิมเข้า project "Golden Batch"
// (ไฟล์เดิมเก็บไว้เป็น backup ไม่ลบ)
async function ensureProjectsDir() {
  if (await exists(PROJECTS_DIR)) return;
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  if (!(await exists(LEGACY_TAGS))) return;
  try {
    const parsed = JSON.parse(await fs.readFile(LEGACY_TAGS, "utf-8"));
    const tags: SavedTag[] = Array.isArray(parsed) ? parsed : [];
    await writeProject(newProject("golden-batch", "Golden Batch", tags));
  } catch {
    /* ไฟล์เดิมเสีย → เริ่มว่าง */
  }
}

async function writeProject(p: Project) {
  await fs.writeFile(projectFile(p.id), JSON.stringify(p, null, 2), "utf-8");
}

async function purgeTrash() {
  if (!(await exists(TRASH_DIR))) return;
  const now = Date.now();
  for (const f of await fs.readdir(TRASH_DIR)) {
    if (!f.endsWith(".json")) continue;
    const deletedAt = Number(f.split("__")[1]?.replace(".json", ""));
    if (deletedAt && now - deletedAt > TRASH_DAYS * DAY_MS) {
      await fs.rm(path.join(TRASH_DIR, f), { force: true });
      await fs.rm(path.join(TRASH_DIR, f.replace(".json", "")), { recursive: true, force: true });
    }
  }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await ensureProjectsDir();
  await purgeTrash();
  const out: ProjectSummary[] = [];
  for (const f of await fs.readdir(PROJECTS_DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      const p = JSON.parse(await fs.readFile(path.join(PROJECTS_DIR, f), "utf-8")) as Project;
      out.push({ id: p.id, name: p.name, updatedAt: p.updatedAt, tagCount: p.tags.length });
    } catch {
      /* skip broken file */
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<Project | null> {
  await ensureProjectsDir();
  try {
    return JSON.parse(await fs.readFile(projectFile(id), "utf-8")) as Project;
  } catch {
    return null;
  }
}

export async function createProject(name: string): Promise<Project> {
  await ensureProjectsDir();
  const base = slugify(name);
  let id = base;
  for (let i = 2; await exists(projectFile(id)); i++) id = `${base}-${i}`;
  const p = newProject(id, name);
  await writeProject(p);
  return p;
}

// คิวเขียนต่อ project — กัน PATCH 2 ตัวพร้อมกัน (เช่น tags + settings) อ่านไฟล์เก่าแล้วเขียนทับกัน
const writeQueue = new Map<string, Promise<unknown>>();

// อ่าน-แก้-เขียน project ในคิวเดียวกัน (fn คืน patch ที่จะ merge)
export function mutateProject(
  id: string,
  fn: (p: Project) => Partial<Omit<Project, "id" | "createdAt" | "updatedAt">>,
): Promise<Project | null> {
  const run = async () => {
    const p = await getProject(id);
    if (!p) return null;
    const next: Project = { ...p, ...fn(p), id: p.id, createdAt: p.createdAt, updatedAt: new Date().toISOString() };
    await writeProject(next);
    return next;
  };
  const job = (writeQueue.get(id) ?? Promise.resolve()).then(run, run);
  writeQueue.set(id, job.catch(() => undefined));
  return job;
}

// อัปเดตเฉพาะ field ที่ส่งมา (id/createdAt แก้ไม่ได้)
export function updateProject(
  id: string,
  patch: Partial<Omit<Project, "id" | "createdAt" | "updatedAt">>,
): Promise<Project | null> {
  return mutateProject(id, () => patch);
}

export async function trashProject(id: string): Promise<boolean> {
  const file = projectFile(id);
  if (!(await exists(file))) return false;
  await fs.mkdir(TRASH_DIR, { recursive: true });
  const stamp = `${id}__${Date.now()}`;
  await fs.rename(file, path.join(TRASH_DIR, `${stamp}.json`));
  if (await exists(projectDir(id))) await fs.rename(projectDir(id), path.join(TRASH_DIR, stamp));
  return true;
}

export async function listTrash(): Promise<TrashedProject[]> {
  await purgeTrash();
  if (!(await exists(TRASH_DIR))) return [];
  const out: TrashedProject[] = [];
  for (const f of await fs.readdir(TRASH_DIR)) {
    if (!f.endsWith(".json")) continue;
    const [id, ts] = f.replace(".json", "").split("__");
    const deletedAt = Number(ts);
    if (!id || !deletedAt) continue;
    try {
      const p = JSON.parse(await fs.readFile(path.join(TRASH_DIR, f), "utf-8")) as Project;
      out.push({
        id,
        name: p.name,
        deletedAt: new Date(deletedAt).toISOString(),
        purgeAt: new Date(deletedAt + TRASH_DAYS * DAY_MS).toISOString(),
        file: f,
      });
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

// กู้คืนจากถัง — ถ้า id ซ้ำกับ project ที่มีอยู่ จะได้ id ใหม่
export async function restoreProject(file: string): Promise<Project | null> {
  if (!/^[a-z0-9-]+__\d+\.json$/.test(file)) return null;
  const src = path.join(TRASH_DIR, file);
  if (!(await exists(src))) return null;
  const p = JSON.parse(await fs.readFile(src, "utf-8")) as Project;
  let id = p.id;
  for (let i = 2; await exists(projectFile(id)); i++) id = `${p.id}-${i}`;
  const restored = { ...p, id, updatedAt: new Date().toISOString() };
  await writeProject(restored);
  await fs.rm(src, { force: true });
  const srcDir = path.join(TRASH_DIR, file.replace(".json", ""));
  if (await exists(srcDir)) await fs.rename(srcDir, projectDir(id));
  return restored;
}
