import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { ANALYSIS_SERVICE_URL } from "@/lib/config";
import { getProject, mutateProject, projectDir, slugify } from "@/lib/projects";
import { fileTag, FILE_TAG_PREFIX, type Project, type ProjectFile, type SavedTag } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const EXTS = [".csv", ".xlsx"] as const;
const ID_RE = /^[a-z0-9-]+$/;

const err = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

type IngestMeta = Omit<ProjectFile, "id" | "name" | "ext" | "uploadedAt">;

// ให้ analysis-service อ่านไฟล์ → cache + metadata (columns, ช่วงเวลา, sheets)
async function ingest(
  project: string,
  fileId: string,
  ext: string,
  opts: { sheet?: string | null; timeColumn?: string | null } = {},
): Promise<IngestMeta> {
  const res = await fetch(`${ANALYSIS_SERVICE_URL}/files/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, fileId, ext, ...opts }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || "อ่านไฟล์ไม่สำเร็จ");
  return json as IngestMeta;
}

// แทน tag ของไฟล์นี้ใน project ด้วย tag ใหม่ (column ตัวเลข) — group = ชื่อไฟล์
function withFileTags(p: Project, f: ProjectFile | null, fileId: string) {
  const prefix = `${FILE_TAG_PREFIX}${fileId}/`;
  const kept = p.tags.filter((t) => !t.tag.startsWith(prefix));
  const added: SavedTag[] = f
    ? f.columns.map((c) => ({ tag: fileTag(f.id, c), description: c, group: f.name }))
    : [];
  const tags = [...kept, ...added];
  const used = new Set(tags.map((t) => t.group).filter(Boolean));
  const old = (p.files ?? []).find((x) => x.id === fileId)?.name;
  const groups = Array.from(
    new Set([...p.groups.filter((g) => g !== old || used.has(g)), ...(f ? [f.name] : [])]),
  );
  const files = [...(p.files ?? []).filter((x) => x.id !== fileId), ...(f ? [f] : [])];
  return { tags, groups, files };
}

// POST multipart (file) → บันทึกไฟล์ + ingest + เพิ่ม tag เข้า project
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return err("project not found", 404);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return err("ต้องแนบไฟล์");
  const ext = path.extname(file.name).toLowerCase() as (typeof EXTS)[number];
  if (!EXTS.includes(ext)) return err("รองรับเฉพาะ .csv และ .xlsx");

  const base = slugify(path.basename(file.name, ext)).slice(0, 40);
  const taken = new Set((project.files ?? []).map((f) => f.id));
  let fileId = base;
  for (let i = 2; taken.has(fileId); i++) fileId = `${base}-${i}`;

  const dir = path.join(projectDir(id), "files");
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${fileId}${ext}`);
  await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));

  try {
    const meta = await ingest(id, fileId, ext);
    const f: ProjectFile = { id: fileId, name: file.name, ext, ...meta, uploadedAt: new Date().toISOString() };
    const p = await mutateProject(id, (cur) => withFileTags(cur, f, fileId));
    return NextResponse.json(p);
  } catch (e) {
    await fs.rm(dest, { force: true });
    return err(e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ");
  }
}

// PATCH { fileId, sheet?, timeColumn? } → อ่านไฟล์ใหม่ด้วย sheet/column เวลาที่เลือก
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    fileId?: string;
    sheet?: string | null;
    timeColumn?: string | null;
  };
  const project = await getProject(id).catch(() => null);
  const cur = project?.files?.find((f) => f.id === body.fileId);
  if (!project || !cur) return err("file not found", 404);
  try {
    const meta = await ingest(id, cur.id, cur.ext, {
      sheet: body.sheet ?? cur.sheet,
      timeColumn: body.timeColumn,
    });
    const f: ProjectFile = { ...cur, ...meta };
    const p = await mutateProject(id, (c) => withFileTags(c, f, cur.id));
    return NextResponse.json(p);
  } catch (e) {
    return err(e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ");
  }
}

// DELETE ?fileId= → ลบไฟล์ + cache + tag ของไฟล์นั้น
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const fileId = req.nextUrl.searchParams.get("fileId") ?? "";
  const project = await getProject(id).catch(() => null);
  const cur = project?.files?.find((f) => f.id === fileId);
  if (!project || !cur || !ID_RE.test(fileId)) return err("file not found", 404);
  const dir = path.join(projectDir(id), "files");
  await fs.rm(path.join(dir, `${fileId}${cur.ext}`), { force: true });
  await fs.rm(path.join(dir, `${fileId}.pkl`), { force: true });
  const p = await mutateProject(id, (c) => withFileTags(c, null, fileId));
  return NextResponse.json(p);
}
