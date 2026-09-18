import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const file = path.join(DATA_DIR, `${safeName(name)}.json`);
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(name: string, data: unknown): Promise<void> {
  await ensureDataDir();
  const file = path.join(DATA_DIR, `${safeName(name)}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}
