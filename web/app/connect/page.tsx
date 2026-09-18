"use client";

import { useState } from "react";

interface SqlConfig {
  host: string;
  user: string;
  password: string;
  port: number;
  database: string;
}

interface Column {
  name: string;
  type: string;
}

export default function ConnectPage() {
  const [cfg, setCfg] = useState<SqlConfig>({
    host: "",
    user: "",
    password: "",
    port: 1433,
    database: "",
  });

  const [testState, setTestState] = useState<"idle" | "loading" | "ok" | "fail">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof SqlConfig>(key: K, value: SqlConfig[K]) {
    setCfg((c) => ({ ...c, [key]: value }));
  }

  async function post(action: string, extra: Record<string, unknown> = {}) {
    const payload: Record<string, unknown> = { ...cfg, ...extra };
    if (!payload.database) delete payload.database;
    const res = await fetch(`/api/connections/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || "request failed");
    return data;
  }

  async function testConnection() {
    setTestState("loading");
    setMessage("");
    setDatabases([]);
    setSelectedDb("");
    setTables([]);
    setSelectedTable("");
    setColumns([]);
    try {
      await post("test");
      const data = await post("databases");
      setDatabases(data.databases ?? []);
      setTestState("ok");
      setMessage("Connected");
    } catch (e) {
      setTestState("fail");
      setMessage(e instanceof Error ? e.message : "Connection failed");
    }
  }

  async function loadTables(db: string) {
    setSelectedDb(db);
    setTables([]);
    setSelectedTable("");
    setColumns([]);
    if (!db) return;
    setBusy(true);
    try {
      const data = await post("tables", { database: db });
      setTables(data.tables ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load tables");
    } finally {
      setBusy(false);
    }
  }

  async function loadColumns(table: string) {
    setSelectedTable(table);
    setColumns([]);
    if (!table) return;
    setBusy(true);
    try {
      const data = await post("columns", {
        database: selectedDb,
        table,
      });
      setColumns(data.columns ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load columns");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Connect SQL Server</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Enter connection details (read-only), then pick database → table → column
      </p>

      <section className="mt-8 grid gap-4 rounded-lg border border-neutral-800 bg-neutral-900/50 p-5 sm:grid-cols-2">
        <Field label="Host / Server">
          <input
            className="input"
            placeholder="172.29.159.93"
            value={cfg.host}
            onChange={(e) => update("host", e.target.value)}
          />
        </Field>
        <Field label="Port">
          <input
            className="input"
            type="number"
            value={cfg.port}
            onChange={(e) => update("port", Number(e.target.value))}
          />
        </Field>
        <Field label="Username">
          <input
            className="input"
            value={cfg.user}
            onChange={(e) => update("user", e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            value={cfg.password}
            onChange={(e) => update("password", e.target.value)}
          />
        </Field>
        <Field label="Database (optional)">
          <input
            className="input"
            placeholder="empty = master"
            value={cfg.database}
            onChange={(e) => update("database", e.target.value)}
          />
        </Field>

        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            onClick={testConnection}
            disabled={testState === "loading" || !cfg.host || !cfg.user}
          >
            {testState === "loading" ? "Connecting..." : "Test connection"}
          </button>
          {message && (
            <span
              className={
                testState === "ok" ? "text-sm text-emerald-400" : "text-sm text-red-400"
              }
            >
              {message}
            </span>
          )}
        </div>
      </section>

      {databases.length > 0 && (
        <section className="mt-8 grid gap-6 md:grid-cols-3">
          <Picker
            title="Databases"
            items={databases}
            selected={selectedDb}
            onSelect={loadTables}
          />
          <Picker
            title="Tables / Views"
            items={tables}
            selected={selectedTable}
            onSelect={loadColumns}
            empty={selectedDb ? "No tables" : "Select a database first"}
          />
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <h3 className="mb-2 text-sm font-medium text-neutral-300">Columns</h3>
            {columns.length === 0 ? (
              <p className="text-xs text-neutral-500">
                {selectedTable ? "..." : "Select a table first"}
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto text-sm">
                {columns.map((c) => (
                  <li
                    key={c.name}
                    className="flex justify-between border-b border-neutral-800/60 py-1"
                  >
                    <span>{c.name}</span>
                    <span className="text-neutral-500">{c.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {busy && <p className="mt-4 text-xs text-neutral-500">loading...</p>}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid rgb(38 38 38);
          background: rgb(10 10 10);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: rgb(229 229 229);
        }
        .input:focus {
          outline: none;
          border-color: rgb(16 185 129);
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function Picker({
  title,
  items,
  selected,
  onSelect,
  empty = "—",
}: {
  title: string;
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
  empty?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
      <h3 className="mb-2 text-sm font-medium text-neutral-300">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-neutral-500">{empty}</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto text-sm">
          {items.map((it) => (
            <li key={it}>
              <button
                onClick={() => onSelect(it)}
                className={`w-full truncate rounded px-2 py-1 text-left hover:bg-neutral-800 ${
                  selected === it ? "bg-neutral-800 text-emerald-400" : ""
                }`}
              >
                {it}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
