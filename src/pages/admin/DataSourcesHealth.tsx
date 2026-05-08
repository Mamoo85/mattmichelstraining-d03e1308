import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  product: string;
  source_key: string;
  source_name: string;
  category: string | null;
  status: "live" | "stub" | "needs_key" | "blocked";
  blocker: string | null;
  required_secret: string | null;
  last_attempted_at: string | null;
  last_result_count: number | null;
};

const STATUS_BADGE: Record<Row["status"], { label: string; cls: string }> = {
  live: { label: "✅ Live", cls: "bg-green-500/20 text-green-300 border-green-500/40" },
  stub: { label: "🟡 Ready to wire", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  needs_key: { label: "🔑 Needs secret", cls: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  blocked: { label: "❌ Blocked", cls: "bg-red-500/20 text-red-300 border-red-500/40" },
};

const ORDER: Record<Row["status"], number> = { live: 0, stub: 1, needs_key: 2, blocked: 3 };

export default function DataSourcesHealth() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any)
      .from("source_registry")
      .select("*")
      .then(({ data }: { data: Row[] | null }) => {
        const sorted = (data || []).slice().sort(
          (a, b) => ORDER[a.status] - ORDER[b.status] || a.source_name.localeCompare(b.source_name),
        );
        setRows(sorted);
        setLoading(false);
      });
  }, []);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <Helmet>
        <title>Data Sources Health · DWA Admin</title>
      </Helmet>
      <main className="max-w-6xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-bold mb-2">Data Sources Health</h1>
        <p className="text-white/60 text-sm mb-6">
          Every external data source TechAlert can read from. Sources marked "Ready to wire" or "Needs secret"
          are next-up — text Matt "WIRE" and he'll have Claude implement the next batch.
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          {(["live", "stub", "needs_key", "blocked"] as const).map((s) => (
            <div key={s} className={`rounded-lg border px-3 py-2 text-sm ${STATUS_BADGE[s].cls}`}>
              {STATUS_BADGE[s].label}: <span className="font-bold">{counts[s] || 0}</span>
            </div>
          ))}
        </div>

        {loading && <div className="text-white/60">Loading…</div>}

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0f1f35]">
          <table className="w-full text-sm">
            <thead className="bg-[#061021] text-white/60 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Blocker / Notes</th>
                <th className="text-left px-4 py-3">Secret needed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.product}-${r.source_key}`} className="border-t border-white/5">
                  <td className="px-4 py-3 font-medium">{r.source_name}</td>
                  <td className="px-4 py-3 text-white/60">{r.category}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs ${STATUS_BADGE[r.status].cls}`}>
                      {STATUS_BADGE[r.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">{r.blocker || "—"}</td>
                  <td className="px-4 py-3 text-white/60 font-mono text-xs">{r.required_secret || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
