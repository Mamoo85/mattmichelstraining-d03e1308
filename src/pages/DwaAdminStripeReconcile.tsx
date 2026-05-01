import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { CreditCard, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

interface Mismatch {
  session_id: string;
  email: string;
  product: string;
  type: string;
  amount_cents: number;
  created_at: string;
  reason: "no_provisioning" | "unknown_type";
}

interface Diff {
  ok: boolean;
  window_days: number;
  total_paid_sessions: number;
  total_provisioned: number;
  mismatch_count: number;
  by_product: Record<string, { paid: number; provisioned: number }>;
  mismatches: Mismatch[];
  generated_at: string;
}

export default function DwaAdminStripeReconcile() {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("dwa-v4-stripe-reconcile-diff", {
        body: {},
      });
      if (err) throw err;
      setDiff(data as Diff);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <SEOHead title="DWA Admin — Stripe Reconciliation" description="Stripe vs provisioning diff." />
      <div className="min-h-screen bg-background text-foreground p-6 md:p-10 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-cyan-400" />
              Stripe Reconciliation
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Last 7 days · Stripe paid sessions vs local product tables
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="bg-cyan-500 text-slate-900 font-bold text-sm px-4 py-2 rounded-lg hover:bg-cyan-400 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="border border-rose-500/40 bg-rose-500/10 text-rose-300 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {diff && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Kpi label="Paid sessions (7d)" value={diff.total_paid_sessions} tone="cyan" />
              <Kpi label="Provisioned" value={diff.total_provisioned} tone="emerald" />
              <Kpi label="Mismatches" value={diff.mismatch_count} tone={diff.mismatch_count ? "rose" : "emerald"} />
            </div>

            <section>
              <h2 className="text-xl font-bold mb-3">By product</h2>
              <div className="grid gap-2">
                {Object.entries(diff.by_product).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No paid sessions in window.</p>
                ) : (
                  Object.entries(diff.by_product).map(([label, c]) => {
                    const ok = c.provisioned === c.paid;
                    return (
                      <div
                        key={label}
                        className={`border rounded-lg p-3 flex items-center justify-between ${
                          ok
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-rose-500/30 bg-rose-500/5"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {ok ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          )}
                          <span className="font-bold">{label}</span>
                        </div>
                        <span className="text-sm font-mono">
                          {c.provisioned}/{c.paid}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3">
                Mismatches{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  (showing {diff.mismatches.length})
                </span>
              </h2>
              {diff.mismatches.length === 0 ? (
                <p className="text-sm text-emerald-400">✓ Every paid session is provisioned.</p>
              ) : (
                <div className="grid gap-2">
                  {diff.mismatches.map((m) => (
                    <div
                      key={m.session_id}
                      className="border border-rose-500/30 bg-rose-500/5 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-bold">
                            <span className="truncate">{m.email || "(no email)"}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                              {m.reason === "no_provisioning" ? "no provisioning" : "unknown type"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {m.product} · ${(m.amount_cents / 100).toFixed(2)} ·{" "}
                            {new Date(m.created_at).toLocaleString()}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                            {m.session_id}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="text-xs text-muted-foreground">
              Generated {new Date(diff.generated_at).toLocaleString()} · auto-fix runs nightly via{" "}
              <code className="px-1 rounded bg-white/10">agency-payment-reconcile</code>
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "emerald" | "rose";
}) {
  const map = {
    cyan: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-300",
  };
  return (
    <div className={`border rounded-xl p-5 ${map[tone]}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-3xl font-black mt-2 text-white">{value.toLocaleString()}</div>
    </div>
  );
}
