import { NextResponse } from "next/server";
import { ANALYSIS_SERVICE_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${ANALYSIS_SERVICE_URL}/health`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { web: "ok", analysisService: "unreachable", status: res.status },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json({ web: "ok", analysisService: data });
  } catch {
    return NextResponse.json(
      { web: "ok", analysisService: "unreachable" },
      { status: 502 }
    );
  }
}
