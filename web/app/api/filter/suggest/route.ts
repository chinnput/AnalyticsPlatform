import { NextRequest, NextResponse } from "next/server";
import { ANALYSIS_SERVICE_URL } from "@/lib/config";

export async function POST(req: NextRequest) {
  const body = await req.text();
  try {
    const res = await fetch(`${ANALYSIS_SERVICE_URL}/filter/suggest`, {
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
