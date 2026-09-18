import { NextRequest, NextResponse } from "next/server";
import { ANALYSIS_SERVICE_URL } from "@/lib/config";

const ALLOWED = new Set(["test", "databases", "tables", "columns"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  if (!ALLOWED.has(action)) {
    return NextResponse.json({ error: "unknown action" }, { status: 404 });
  }

  const body = await req.text();
  try {
    const res = await fetch(`${ANALYSIS_SERVICE_URL}/connections/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "analysis service unreachable" },
      { status: 502 }
    );
  }
}
