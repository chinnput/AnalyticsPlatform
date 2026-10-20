import { NextRequest, NextResponse } from "next/server";
import { ANALYSIS_SERVICE_URL } from "@/lib/config";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json({ error: "invalid function name" }, { status: 400 });
  }

  const body = await req.text();
  try {
    const res = await fetch(
      `${ANALYSIS_SERVICE_URL}/functions/${encodeURIComponent(name)}/run`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "analysis service unreachable" },
      { status: 502 }
    );
  }
}
