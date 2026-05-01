import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Activity, TrendingUp, Sparkles, Loader2 } from "lucide-react";

interface HealthRow {
  id: string;
  client_email: string;
  product: string;
  score: number;
  status: "green" | "yellow" | "red";
  signals: any;
  created_at: string;
}

interface UpsellRow {
  id: string;
  client_email: string;
  current_product: string;
  suggested_addon: string;
  trigger_reason: string;
  pitched_at: string | null;
  outcome: string | null;
  created_at: string;
}

const statusColor = {
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  yellow: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  red: "bg-rose-500/10 text-rose-400 border-rose-500/30",
} as const;

export default function DwaAdminV4() {
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [upsells, setUpsells] = useState<UpsellRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: h }, { data: u }] = await Promise.all([
      supabase
        .from("client_health_scores" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("upsell_opportunities" as any)
        .select("*")
        .is("pitched_at", null)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setHealth((h as any) || []);
    setUpsells((u as any) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function runSweep() {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("dwa-v4-retention-sweep", { body: {} });
      if (error) throw error;
      await load();
      alert("Sweep complete — check SMS for digest.");
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  async function pitchUpsell(row: UpsellRow) {
    const { error } = await supabase
      .from("upsell_opportunities" as any)
      .update({ pitched_at: new Date().toISOString(), outcome: "pending" })
      .eq("id", row.id);
    if (error) {
      alert(`Failed: ${error.message}`);
      return;
    }
    alert(`Marked as pitched. Now send the email to ${row.client_email} from your inbox.`);
    await load();
  }

  return (
    <>
      <SEOHead title="DWA Admin — v4 Retention" description="Client health, upsells, anniversary notices." />
      <div className="min-h-screen bg-background text-foreground p-6 md:p-10 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">v4 Retention Console</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Health scores · Upsell triggers · Anniversary notices
            </p>
          </div>
          <button
            onClick={runSweep}
            disabled={running}
            className="bg-cyan-500 text-slate-900 font-bold text-sm px-4 py-2 rounded-lg hover:bg-cyan-400 disabled:opacity-50 flex items-center gap-2"
          >
            {running && <Loader2 className="w-4 h-4 animate-spin" />}
            {running ? "Running…" : "Run sweep now"}
          </button>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-10">
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-bold">Health Scores (latest 50)</h2>
              </div>
              <div className="grid gap-2">
                {health.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No scores yet. Run the sweep on a Monday to populate.
                  </p>
                ) : (
                  health.map((h) => (
                    <div
                      key={h.id}
                      className={`border rounded-lg p-3 flex items-center justify-between ${statusColor[h.status]}`}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs truncate">{h.client_email}</div>
                        <div className="text-xs opacity-80">
                          {h.product} · {new Date(h.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="text-2xl font-black">{h.score}</div>
                        <div className="text-[10px] uppercase tracking-wide font-bold">{h.status}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-bold">Upsell Opportunities (unpitched)</h2>
              </div>
              <div className="grid gap-3">
                {upsells.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active upsells detected. The daily sweep adds new ones automatically.
                  </p>
                ) : (
                  upsells.map((u) => (
                    <div key={u.id} className="border border-border bg-card rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="font-bold truncate">{u.client_email}</span>
                          </div>
                          <p className="text-sm">
                            <span className="text-muted-foreground">{u.current_product}</span>{" "}
                            <span className="text-emerald-400">→ {u.suggested_addon}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{u.trigger_reason}</p>
                        </div>
                        <button
                          onClick={() => pitchUpsell(u)}
                          className="bg-emerald-500 text-slate-900 font-bold text-xs px-3 py-1.5 rounded-md hover:bg-emerald-400 shrink-0"
                        >
                          Mark pitched
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
