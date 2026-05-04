import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, DollarSign, Activity, Heart, Database } from "lucide-react";

type AuditResult = {
  ts: string;
  stripe_reconcile?: { active_subs: number; orphans: any[]; error?: string };
  customer_health?: { at_risk: any[]; error?: string };
  mortgage_radar?: { window: string; total_leads: number; by_source: Record<string, any>; no_street_view_pct: number; error?: string };
  dead_functions?: any;
};

export default function AdminSystemAudit() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, error, refetch, isFetching } = useQuery<AuditResult>({
    queryKey: ["system-audit", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-system-audit");
      if (error) throw error;
      return data as AuditResult;
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">🔍 System Audit</h2>
          <p className="text-xs text-white/50">Cross-system reconciliation: Stripe ↔ DB, customer health, Mortgage Radar pipeline.</p>
        </div>
        <button
          onClick={() => { setRefreshKey((k) => k + 1); refetch(); }}
          disabled={isFetching}
          className="px-3 py-1.5 text-xs bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40 rounded font-semibold inline-flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Run audit
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-white/40 text-sm p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Running audit (10–30s)…
        </div>
      )}

      {error && (
        <div className="border border-red-500/40 bg-red-500/10 rounded-lg p-4 text-red-300 text-sm">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          {data.ts && <div className="text-xs text-white/30">Last run: {new Date(data.ts).toLocaleString()}</div>}

          {/* Stripe reconcile */}
          <Section icon={<DollarSign className="h-4 w-4 text-green-400" />} title="Stripe Reconciliation">
            {data.stripe_reconcile?.error ? (
              <div className="text-red-300 text-xs">{data.stripe_reconcile.error}</div>
            ) : (
              <>
                <Stat label="Active subscriptions" value={data.stripe_reconcile?.active_subs ?? 0} />
                <Stat label="Orphans (paying, no DB row)" value={data.stripe_reconcile?.orphans?.length ?? 0} bad={!!data.stripe_reconcile?.orphans?.length} />
                {data.stripe_reconcile?.orphans?.length ? (
                  <div className="mt-2 border border-red-500/30 rounded divide-y divide-red-500/20 bg-red-500/5">
                    {data.stripe_reconcile.orphans.map((o, i) => (
                      <div key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
                        <span className="text-red-200 truncate">{o.email} → {o.product}</span>
                        <a href={`https://dashboard.stripe.com/subscriptions/${o.sub_id}`} target="_blank" rel="noreferrer" className="text-[#00d4ff] text-[10px] hover:underline shrink-0">{o.sub_id}</a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-green-300 text-xs flex items-center gap-1 mt-1"><CheckCircle2 className="h-3.5 w-3.5" /> All paying customers provisioned.</div>
                )}
              </>
            )}
          </Section>

          {/* Customer health */}
          <Section icon={<Heart className="h-4 w-4 text-red-400" />} title="Customer Health">
            {data.customer_health?.error ? (
              <div className="text-red-300 text-xs">{data.customer_health.error}</div>
            ) : data.customer_health?.at_risk?.length ? (
              <div className="border border-white/10 rounded divide-y divide-white/10 bg-white/[0.02]">
                {data.customer_health.at_risk.map((c, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">{c.business_name || c.email}</div>
                      <div className="text-white/40">{c.product} · {c.age_days}d old · {c.leads_last_7d} leads/7d</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      c.risk === "high" ? "bg-red-500/20 text-red-300 border-red-500/40" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                    }`}>{c.risk} risk</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-green-300 text-xs flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> All clients healthy.</div>
            )}
          </Section>

          {/* Mortgage Radar audit */}
          <Section icon={<Activity className="h-4 w-4 text-[#00d4ff]" />} title="Mortgage Radar Live Data (14d)">
            {data.mortgage_radar?.error ? (
              <div className="text-red-300 text-xs">{data.mortgage_radar.error}</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                  <Stat label="Total leads" value={data.mortgage_radar?.total_leads ?? 0} />
                  <Stat label="Sources active" value={Object.keys(data.mortgage_radar?.by_source || {}).length} />
                  <Stat label="No Street View" value={`${data.mortgage_radar?.no_street_view_pct ?? 0}%`} bad={(data.mortgage_radar?.no_street_view_pct ?? 0) > 10} />
                </div>
                <div className="border border-white/10 rounded overflow-hidden text-xs">
                  <div className="bg-white/5 px-3 py-2 grid grid-cols-5 gap-2 font-semibold text-white/60">
                    <span>Source</span><span className="text-right">Count</span><span className="text-right">Avg score</span><span className="text-right">Has SV</span><span className="text-right">LLM-capped</span>
                  </div>
                  {Object.entries(data.mortgage_radar?.by_source || {}).map(([src, s]: [string, any]) => (
                    <div key={src} className="px-3 py-1.5 grid grid-cols-5 gap-2 border-t border-white/5">
                      <span className="text-white truncate">{src}</span>
                      <span className="text-right text-white/80">{s.count}</span>
                      <span className="text-right text-white/80">{s.avg_score}</span>
                      <span className="text-right text-white/80">{s.with_sv}</span>
                      <span className="text-right text-yellow-300">{s.llm_only_capped || 0}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Section>

          {/* Dead functions */}
          <Section icon={<Database className="h-4 w-4 text-purple-400" />} title="Edge Function Inventory">
            <div className="text-xs text-white/60">
              <p>Project has <strong className="text-white">909 edge functions</strong>. For dead-code detection, run:</p>
              <code className="block mt-2 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[11px] text-[#00d4ff]">
                {`# In Cloud → Logs: sources where total_invocations = 0 in last 30d`}
              </code>
              <p className="mt-2 text-white/40">
                Manual cleanup recommended quarterly. Auto-purge would require billing/usage history we don't currently track in DB.
              </p>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-white/10 rounded-lg bg-white/[0.02] p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-bold text-white">{icon}{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: any; bad?: boolean }) {
  return (
    <div className={`px-3 py-2 rounded border ${bad ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/10"}`}>
      <div className={`text-lg font-bold ${bad ? "text-red-300" : "text-white"}`}>{value}</div>
      <div className="text-[10px] text-white/50 uppercase tracking-wider">{label}</div>
    </div>
  );
}
