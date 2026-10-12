import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects, listTrash, restoreProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

// GET /api/projects            → รายการ project + ถังขยะ
export async function GET() {
  return NextResponse.json({ projects: await listProjects(), trash: await listTrash() });
}

// POST /api/projects { name }            → สร้าง project
// POST /api/projects { restore: file }   → กู้คืนจากถัง
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name?: string; restore?: string };
  if (body.restore) {
    const p = await restoreProject(body.restore);
    if (!p) return NextResponse.json({ error: "not found in trash" }, { status: 404 });
    return NextResponse.json(p);
  }
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  return NextResponse.json(await createProject(name));
}
