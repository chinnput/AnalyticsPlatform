import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/storage";
import { emptyWorkspace, Workspace } from "@/lib/types";

function fileName(name: string) {
  return `workspace_${name}`;
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "default";
  const ws = await readJson<Workspace>(fileName(name), emptyWorkspace(name));
  return NextResponse.json(ws);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Workspace;
  const name = body.name || "default";
  const ws: Workspace = { ...body, name, updatedAt: new Date().toISOString() };
  await writeJson(fileName(name), ws);
  return NextResponse.json(ws);
}
