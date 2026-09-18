import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "saved_tags.json");

interface SavedTag {
  tag: string;
  description?: string;
  group?: string;
}

async function readTags(): Promise<SavedTag[]> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTags(tags: SavedTag[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(tags, null, 2), "utf-8");
}

export async function GET() {
  return NextResponse.json({ tags: await readTags() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as SavedTag;
  const tag = (body.tag ?? "").trim();
  if (!tag) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 });
  }
  const tags = await readTags();
  const existing = tags.find((t) => t.tag === tag);
  if (existing) {
    // อัปเดต group/description ของ tag ที่มีอยู่แล้ว
    if (body.group !== undefined) existing.group = body.group;
    if (body.description !== undefined) existing.description = body.description;
  } else {
    tags.push({
      tag,
      description: body.description ?? "",
      group: body.group ?? "",
    });
  }
  await writeTags(tags);
  return NextResponse.json({ tags });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag = (searchParams.get("tag") ?? "").trim();
  if (!tag) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 });
  }
  const tags = (await readTags()).filter((t) => t.tag !== tag);
  await writeTags(tags);
  return NextResponse.json({ tags });
}
