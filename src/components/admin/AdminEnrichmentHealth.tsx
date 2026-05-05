import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface KpiRow {
  id: string;
  function_name: string;
  triggered_by: string;
  leads_attempted: number;
  leads_enriched: number;
  leads_failed: number;
  leads_skipped: number;
  provider_breakdown: Record<string, { ok: number; fail: number; cost_cents: number; ms: number }>;
  total_duration_ms: number;
  avg_ms_per_lead: number;
  cost_cents_total: number;
  throughput_per_hour: number;
  created_at: string;
}

export default function AdminEnrichmentHealth() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["enrichment_run_kpis"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await (supabase as any)
        .from("enrichment_run_kpis")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as KpiRow[];
    },
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="p-6 text-slate-400">Loading enrichment health…</div>;

  const total_attempted = rows?.reduce((s, r) => s + (r.leads_attempted || 0), 0) ?? 0;
  const total_enriched = rows?.reduce((s, r) => s + (r.leads_enriched || 0), 0) ?? 0;
  const total_failed = rows?.reduce((s, r) => s + (r.leads_failed || 0), 0) ?? 0;
  const total_cost = rows?.reduce((s, r) => s + (r.cost_cents_total || 0), 0) ?? 0;
  const hitRate = total_attempted > 0 ? Math.round((total_enriched / total_attempted) * 100) : 0;
  const avgMs = rows?.length
    ? Math.round(rows.reduce((s, r) => s + (r.avg_ms_per_lead || 0), 0) / rows.length)
    : 0;

  // Aggregate provider hits from enrichment_trace — best approximation from provider_breakdown
  const providerHits: Record<string, number> = {};
  for (const row of rows || []) {
    const pb = row.provider_breakdown || {};
    for (const [name, stats] of Object.entries(pb)) {
      if (stats?.ok > 0) providerHits[name] = (providerHits[name] || 0) + stats.ok;
    }
  }
  const topProviders = Object.entries(providerHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const hitRateColor = hitRate >= 40 ? "text-green-400" : hitRate >= 20 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Enrichment Health</h2>
        <p className="text-sm text-slate-400">Last 7 days · {rows?.length ?? 0} runs</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#162236] border-slate-700">
          <CardContent className="pt-4 pb-4 text-center">
            <div className={`text-3xl font-bold ${hitRateColor}`}>{hitRate}%</div>
            <div className="text-xs text-slate-400 mt-1">Email Hit Rate</div>
          </CardContent>
        </Card>
        <Card className="bg-[#162236] border-slate-700">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-cyan-400">{total_enriched.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">Leads Enriched</div>
          </CardContent>
        </Card>
        <Card className="bg-[#162236] border-slate-700">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-slate-300">{avgMs.toLocaleString()}ms</div>
            <div className="text-xs text-slate-400 mt-1">Avg Per Lead</div>
          </CardContent>
        </Card>
        <Card className="bg-[#162236] border-slate-700">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-purple-400">${(total_cost / 100).toFixed(2)}</div>
            <div className="text-xs text-slate-400 mt-1">7-Day Cost</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#162236] border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Top Providers This Week</CardTitle>
          </CardHeader>
          <CardContent>
            {topProviders.length === 0 ? (
              <p className="text-slate-500 text-sm">No provider hits recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {topProviders.map(([name, hits]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300 font-mono">{name}</span>
                    <Badge variant="outline" className="text-cyan-400 border-cyan-800">{hits} hits</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#162236] border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(rows || []).slice(0, 10).map((r) => {
                const rate = r.leads_attempted > 0
                  ? Math.round((r.leads_enriched / r.leads_attempted) * 100)
                  : 0;
                const rateColor = rate >= 40 ? "text-green-400" : rate >= 20 ? "text-yellow-400" : "text-red-400";
                return (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-slate-300">{r.leads_attempted} tried</span>
                    <span className={rateColor}>{rate}% hit</span>
                    <span className="text-slate-500">{r.triggered_by}</span>
                  </div>
                );
              })}
              {!rows?.length && <p className="text-slate-500 text-sm">No runs in the last 7 days.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {hitRate < 20 && total_attempted > 10 && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4">
          <p className="text-red-400 font-semibold text-sm">⚠️ Low hit rate detected ({hitRate}%)</p>
          <p className="text-red-300 text-sm mt-1">
            Less than 20% of leads are getting an email found. Check that Apollo, Hunter, Firecrawl, and Snov API keys are active.
            Typical healthy range is 35–55%.
          </p>
        </div>
      )}
    </div>
  );
}
