import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Activity, Loader2, RefreshCw } from "lucide-react";

interface AgentStatus { name: string; last_beat: string | null; hours_since: number | null; status: "green" | "yellow" | "red"; }
interface TableStatus { table: string; last_row: string | null; hours_since: number | null; status: "green" | "yellow" | "red"; error?: string; }
interface ProductRow {
  product: string;
  overall: "green" | "yellow" | "red";
  agents: AgentStatus[];
  tables: TableStatus[];
  sources: string[];
}
interface Matrix { ok: boolean; generated_at: string; products: ProductRow[]; }

const tone: Record<string, string> = {
  green: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  yellow: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  red: "bg-rose-500/10 border-rose-500/30 text-rose-300",
};

export default function ScannerHealth() {
  const [data, setData] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("scanner-health-matrix", { body: {} });
      if (error) throw error;
      setData(data as Matrix);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <SEOHead title="DWA Admin — Scanner Health" description="Phase 4 scanner & waterfall quality matrix." />
      <div className="min-h-screen bg-background text-foreground p-6 md:p-10 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Activity className="w-7 h-7 text-cyan-400" />
              Scanner Health Matrix
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Per-product agent heartbeats + table freshness. Green ≤26h · Yellow ≤7d · Red &gt;7d.
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="bg-cyan-500 text-slate-900 font-bold text-sm px-4 py-2 rounded-lg hover:bg-cyan-400 disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? "Scanning…" : "Refresh"}
          </button>
        </div>

        {error && <div className="border border-rose-500/40 bg-rose-500/10 text-rose-300 rounded-lg p-4 mb-6">{error}</div>}

        {data && (
          <div className="space-y-4">
            {data.products.map((p) => (
              <div key={p.product} className={`border rounded-xl p-5 ${tone[p.overall]}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">{p.product}</h2>
                  <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${tone[p.overall]}`}>{p.overall}</span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide opacity-80 mb-2">Agents</div>
                    <div className="space-y-1">
                      {p.agents.map((a) => (
                        <div key={a.name} className={`text-xs flex justify-between border rounded px-2 py-1 ${tone[a.status]}`}>
                          <span className="font-mono">{a.name}</span>
                          <span>{a.hours_since !== null ? `${a.hours_since}h ago` : "never"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide opacity-80 mb-2">Data writes</div>
                    <div className="space-y-1">
                      {p.tables.map((t) => (
                        <div key={t.table} className={`text-xs flex justify-between border rounded px-2 py-1 ${tone[t.status]}`}>
                          <span className="font-mono">{t.table}</span>
                          <span>{t.hours_since !== null ? `${t.hours_since}h ago` : t.error || "no rows"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wide opacity-80 mb-2">Declared sources ({p.sources.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {p.sources.map((s) => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <p className="text-xs text-muted-foreground">Generated {new Date(data.generated_at).toLocaleString()}</p>
          </div>
        )}
      </div>
    </>
  );
}
