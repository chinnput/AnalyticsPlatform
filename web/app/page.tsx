import { ANALYSIS_SERVICE_URL } from "@/lib/config";

async function getHealth() {
  try {
    const res = await fetch(`${ANALYSIS_SERVICE_URL}/health`, {
      cache: "no-store",
    });
    if (!res.ok) return { ok: false as const };
    return { ok: true as const, data: await res.json() };
  } catch {
    return { ok: false as const };
  }
}

export default async function Home() {
  const health = await getHealth();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Analytics Platform</h1>
      <p className="mt-2 text-neutral-400">
        Tag management &amp; analysis workspace — Phase 0 setup
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <StatusCard label="Web (Next.js)" ok healthy="running" />
        <StatusCard
          label="Analysis Service (FastAPI)"
          ok={health.ok}
          healthy={health.ok ? "connected" : "unreachable"}
        />
      </div>

      {health.ok && (
        <pre className="mt-6 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300">
          {JSON.stringify(health.data, null, 2)}
        </pre>
      )}

      {!health.ok && (
        <p className="mt-6 rounded-lg border border-amber-800/50 bg-amber-950/30 p-4 text-sm text-amber-300">
          Analysis service is not reachable. Start it with{" "}
          <code className="rounded bg-black/40 px-1">uvicorn app.main:app --reload --port 8000</code>{" "}
          in the <code className="rounded bg-black/40 px-1">analysis-service</code> folder.
        </p>
      )}
    </main>
  );
}

function StatusCard({
  label,
  ok,
  healthy,
}: {
  label: string;
  ok: boolean;
  healthy: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            ok ? "bg-emerald-500" : "bg-red-500"
          }`}
        />
        <span className="font-medium">{label}</span>
      </div>
      <p className="mt-1 text-sm text-neutral-400">{healthy}</p>
    </div>
  );
}
