import { NextResponse } from "next/server";
import { ANALYSIS_SERVICE_URL } from "@/lib/config";

export async function GET() {
  try {
    const res = await fetch(`${ANALYSIS_SERVICE_URL}/functions`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "analysis service unreachable" },
      { status: 502 }
    );
  }
}
