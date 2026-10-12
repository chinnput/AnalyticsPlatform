import { NextRequest, NextResponse } from "next/server";
import { getProject, trashProject, updateProject } from "@/lib/projects";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "project not found" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    return (await getProject(id).then((p) => p && NextResponse.json(p))) ?? notFound();
  } catch {
    return notFound();
  }
}

// PATCH: อัปเดตบาง field (name, tags, groups, classDefs, settings)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as Partial<Project>;
  const patch: Partial<Project> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (Array.isArray(body.tags)) patch.tags = body.tags;
  if (Array.isArray(body.groups)) patch.groups = body.groups;
  if (Array.isArray(body.classDefs)) patch.classDefs = body.classDefs;
  if (body.settings && typeof body.settings === "object") patch.settings = body.settings;
  try {
    const p = await updateProject(id, patch);
    return p ? NextResponse.json(p) : notFound();
  } catch {
    return notFound();
  }
}

// DELETE: ย้ายลงถัง (ลบจริงเมื่อเกิน 7 วัน)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    return (await trashProject(id)) ? NextResponse.json({ ok: true }) : notFound();
  } catch {
    return notFound();
  }
}
