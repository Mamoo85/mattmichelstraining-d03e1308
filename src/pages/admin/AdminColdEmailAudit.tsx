import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const FLOOR = 150;
const DEFAULT_POOL_THRESHOLD = 50;

const COLD_TEMPLATES = [
  "cold_outreach",
  "multi_service_pitch_1", "multi_service_pitch_2", "multi_service_pitch_3",
  "web_drip_d1", "web_drip_d4", "web_drip_d8", "web_drip_d15",
  "techalert_cold_outreach", "techalert_followup_d3", "techalert_followup_d7", "techalert_followup_d14",
  "contractor_drip_d0", "contractor_drip_d3", "contractor_drip_d7", "contractor_drip_d14",
  "dossier_cold_outreach",
];

const SENDERS: { fn: string; label: string; product: string; trial: string }[] = [
  { fn: "contractor-prospector", label: "Contractor Prospector", product: "Contractor Leads", trial: "7d + 50% off" },
  { fn: "techalert-outreach", label: "TechAlert Outreach", product: "TechAlert (Hiring)", trial: "30d" },
  { fn: "techalert-followup-drip", label: "TechAlert Drip (D3/D7/D14)", product: "TechAlert (Hiring)", trial: "30d" },
  { fn: "multi-service-drip", label: "Multi-Service Drip", product: "Bundle", trial: "7d + 50% off" },
  { fn: "web-design-drip", label: "Web Design Drip", product: "Web Design", trial: "7d + 50% off" },
  { fn: "prospect-local-businesses", label: "Local Business Prospector", product: "Local Bundle", trial: "7d + 50% off" },
];

interface DayBucket { date: string; count: number }
interface TplBucket { template: string; count: number }
interface PoolRow { name: string; fn: string; available: number }
interface PlanRow { fn: string; pool: string; available: number; planned_send: number }
interface SupplyPool { product: string; key: string; unsent_with_email: number; unenriched_no_email: number }
interface KpiRow { run_at: string; function_name: string; leads_attempted: number; leads_enriched: number; leads_failed: number; leads_skipped: number; throughput_per_hour: number; cost_cents_total: number; provider_breakdown: any; }
interface BudgetRow { provider: string; cap_usd: number; spent_usd: number; pct: number; }
interface BreakerRow { id: string; tripped_at: string; reason: string; metric_value: number; threshold: number; cleared_at: string | null; auto_reset_at: string; }

export default function AdminColdEmailAudit() {
  const [days, setDays] = useState<DayBucket[]>([]);
  const [today, setToday] = useState<TplBucket[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [supply, setSupply] = useState<SupplyPool[]>([]);
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [planMeta, setPlanMeta] = useState<{ sentToday: number; gap: number; target: number } | null>(null);
  const [target, setTarget] = useState(FLOOR);
  const [poolThreshold, setPoolThreshold] = useState(DEFAULT_POOL_THRESHOLD);
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [breaker, setBreaker] = useState<BreakerRow | null>(null);

  const loadVolume = async () => {
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data, error } = await supabase
      .from("email_send_log")
      .select("message_id, template_name, status, created_at")
      .in("template_name", COLD_TEMPLATES)
      .eq("status", "sent")
      .gte("created_at", since)
      .limit(10000);
    if (error) { toast.error(error.message); return; }
    const seen = new Set<string>();
    const dedup = (data || []).filter((r: any) => {
      if (!r.message_id || seen.has(r.message_id)) return false;
      seen.add(r.message_id);
      return true;
    });
    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      byDay.set(d, 0);
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const tplToday = new Map<string, number>();
    for (const r of dedup) {
      const d = (r.created_at as string).slice(0, 10);
      byDay.set(d, (byDay.get(d) || 0) + 1);
      if (d === todayStr) tplToday.set(r.template_name, (tplToday.get(r.template_name) || 0) + 1);
    }
    setDays([...byDay.entries()].map(([date, count]) => ({ date, count })));
    setToday([...tplToday.entries()].map(([template, count]) => ({ template, count })).sort((a, b) => b.count - a.count));
  };

  const loadSupply = async () => {
    // Outreach pool (multi-service / web design / local business all share this)
    const [unsentOutreach, unenrichedOutreach, unsentContractor, unenrichedContractor, unsentTech] = await Promise.all([
      supabase.from("outreach_leads").select("id", { count: "exact", head: true })
        .or("owner_email.not.is.null,enriched_email.not.is.null,validated_email.not.is.null,email.not.is.null")
        .is("last_contact_date", null),
      supabase.from("outreach_leads").select("id", { count: "exact", head: true })
        .is("owner_email", null).is("enriched_email", null).is("validated_email", null).is("email", null),
      supabase.from("contractor_outreach_prospects").select("id", { count: "exact", head: true })
        .not("email", "is", null).is("last_emailed_at", null).is("suppressed_at", null),
      supabase.from("contractor_outreach_prospects").select("id", { count: "exact", head: true })
        .is("email", null).is("suppressed_at", null),
      supabase.from("hire_alert_candidates").select("id", { count: "exact", head: true })
        .eq("enrichment_status", "enriched"),
    ]);
    setSupply([
      { product: "Outreach Pool (Multi/Web/Local)", key: "outreach", unsent_with_email: unsentOutreach.count ?? 0, unenriched_no_email: unenrichedOutreach.count ?? 0 },
      { product: "Contractor Prospects", key: "contractor", unsent_with_email: unsentContractor.count ?? 0, unenriched_no_email: unenrichedContractor.count ?? 0 },
      { product: "TechAlert Candidates", key: "techalert", unsent_with_email: unsentTech.count ?? 0, unenriched_no_email: 0 },
    ]);
  };

  const loadKpisAndBudgets = async () => {
    const [kpiRes, spendRes, capsRes, breakerRes] = await Promise.all([
      supabase.from("enrichment_run_kpis" as any).select("*").order("run_at", { ascending: false }).limit(20),
      supabase.from("provider_spend_today" as any).select("provider, spend_cents"),
      supabase.from("enrichment_walker_config" as any).select("key, value_numeric")
        .in("key", ["apollo_daily_budget_usd", "hunter_daily_budget_usd", "firecrawl_daily_budget_usd"]),
      supabase.from("enrichment_circuit_breaker_state" as any).select("*")
        .is("cleared_at", null).order("tripped_at", { ascending: false }).limit(1),
    ]);
    setKpis((kpiRes.data as any) || []);
    const capMap = new Map<string, number>(((capsRes.data as any) || []).map((r: any) => [r.key, Number(r.value_numeric)]));
    const spendMap = new Map<string, number>(((spendRes.data as any) || []).map((r: any) => [r.provider, Number(r.spend_cents)]));
    const rows: BudgetRow[] = [
      { provider: "apollo",    cap_usd: capMap.get("apollo_daily_budget_usd") ?? 30 },
      { provider: "hunter",    cap_usd: capMap.get("hunter_daily_budget_usd") ?? 15 },
      { provider: "firecrawl", cap_usd: capMap.get("firecrawl_daily_budget_usd") ?? 5 },
    ].map((r) => {
      const spent = (spendMap.get(r.provider) || 0) / 100;
      return { ...r, spent_usd: spent, pct: r.cap_usd > 0 ? Math.round((spent / r.cap_usd) * 100) : 0 };
    });
    setBudgets(rows);
    setBreaker(((breakerRes.data as any) || [])[0] || null);
  };

  const load = async () => {
    setLoading(true);
    await Promise.all([loadVolume(), loadSupply(), loadKpisAndBudgets()]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetBreaker = async () => {
    if (!breaker) return;
    if (!confirm("Reset circuit breaker and unfreeze enrichment budgets?")) return;
    const { error } = await supabase.from("enrichment_circuit_breaker_state" as any)
      .update({ cleared_at: new Date().toISOString(), notes: "manual_reset_ui" })
      .eq("id", breaker.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("enrichment_walker_config" as any)
      .upsert({ key: "budget_frozen", value_numeric: 0, value_text: "false" }, { onConflict: "key" });
    toast.success("Breaker cleared, budget unfrozen");
    load();
  };

  const previewAllocation = async () => {
    setBusy("preview");
    const { data, error } = await supabase.functions.invoke("cold-email-rebalancer", {
      body: { dry_run: true, target },
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const d = data as any;
    setPlan(d.plan || []);
    setPlanMeta({ sentToday: d.sentToday, gap: d.gap, target: d.target });
    toast.success(`Preview: ${d.gap} sends planned across ${(d.plan || []).filter((p: any) => p.planned_send > 0).length} senders.`);
  };

  const runRebalancer = async () => {
    if (!confirm(`Run rebalancer LIVE — send up to ${target} emails today?`)) return;
    setBusy("rebalance");
    const { data, error } = await supabase.functions.invoke("cold-email-rebalancer", {
      body: { force: true, target },
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Rebalancer fired: ${(data as any)?.invoked?.length || 0} senders invoked.`);
    setTimeout(load, 4000);
  };

  const drainEnrichment = async () => {
    if (!confirm("Drain the enrichment backlog? This loops until all unenriched leads have an email or 4 minutes elapse.")) return;
    setBusy("drain");
    const { data, error } = await supabase.functions.invoke("outreach-leads-enrich", {
      body: { drain: true, batch: 50 },
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const d = data as any;
    toast.success(`Drain complete — enriched ${d.enriched}, failed ${d.failed}, skipped ${d.skipped} across ${d.batches} batches`);
    setTimeout(load, 2000);
  };

  const runFn = async (fn: string) => {
    setBusy(fn);
    const { data, error } = await supabase.functions.invoke(fn, { body: { backfill: true } });
    setBusy(null);
    if (error) toast.error(`${fn}: ${error.message}`);
    else toast.success(`${fn} triggered: ${JSON.stringify(data).slice(0, 120)}`);
    setTimeout(load, 3000);
  };

  const runSentinel = async () => {
    setBusy("sentinel");
    const { data, error } = await supabase.functions.invoke("cold-email-volume-sentinel", { body: { force: true } });
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(`Sentinel: sent ${(data as any)?.count}/${target}, shortfall ${(data as any)?.shortfall}`);
    setTimeout(load, 5000);
  };

  const todayCount = days[days.length - 1]?.count || 0;
  const max = Math.max(target, ...days.map((d) => d.count));

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Cold Email Audit</h1>
        <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Today</div>
          <div className={`text-3xl font-bold ${todayCount >= target ? "text-green-500" : "text-destructive"}`}>{todayCount}</div>
          <div className="text-xs">/ {target} target</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">14-day total</div>
          <div className="text-3xl font-bold">{days.reduce((a, d) => a + d.count, 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">14-day avg</div>
          <div className="text-3xl font-bold">{Math.round(days.reduce((a, d) => a + d.count, 0) / 14)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Days under target</div>
          <div className="text-3xl font-bold text-destructive">{days.filter((d) => d.count < target).length}</div>
        </Card>
      </div>

      {/* Supply Pool Card */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Live Supply Pools (unsent with email)</h2>
          <div className="flex items-center gap-2 text-xs">
            <label>Alert threshold:</label>
            <input
              type="number" min={1} value={poolThreshold}
              onChange={(e) => setPoolThreshold(Number(e.target.value) || 50)}
              className="bg-background border border-border px-2 py-0.5 rounded w-20"
            />
            <Button size="sm" variant="outline" onClick={drainEnrichment} disabled={busy === "drain"}>
              {busy === "drain" ? "Draining…" : "Drain Enrichment Backlog"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {supply.map((s) => {
            const low = s.unsent_with_email < poolThreshold;
            return (
              <div key={s.key} className={`border rounded p-3 ${low ? "border-destructive bg-destructive/5" : "border-border"}`}>
                <div className="text-xs text-muted-foreground">{s.product}</div>
                <div className={`text-2xl font-bold ${low ? "text-destructive" : ""}`}>{s.unsent_with_email}</div>
                <div className="text-[10px] text-muted-foreground">ready to send</div>
                {s.unenriched_no_email > 0 && (
                  <div className="text-[11px] text-amber-500 mt-1">⚠ {s.unenriched_no_email} need enrichment</div>
                )}
                {low && <Badge variant="destructive" className="mt-2 text-[9px]">Below threshold</Badge>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Circuit Breaker */}
      {breaker && (
        <Card className="p-4 border-destructive bg-destructive/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-destructive">🛑 Enrichment Circuit Tripped</div>
              <div className="text-xs text-muted-foreground mt-1">
                Reason: <strong>{breaker.reason}</strong> · {Number(breaker.metric_value).toFixed(3)} &gt; {Number(breaker.threshold).toFixed(3)} ·
                tripped {new Date(breaker.tripped_at).toLocaleString()} · auto-reset {new Date(breaker.auto_reset_at).toLocaleString()}
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={resetBreaker}>Reset Breaker</Button>
          </div>
        </Card>
      )}

      {/* Provider Budgets */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Per-Provider Daily Budgets (today)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {budgets.map((b) => {
            const danger = b.pct >= 90;
            const warn = b.pct >= 70;
            return (
              <div key={b.provider} className={`border rounded p-3 ${danger ? "border-destructive" : warn ? "border-amber-500" : "border-border"}`}>
                <div className="text-xs text-muted-foreground uppercase">{b.provider}</div>
                <div className="text-2xl font-bold">${b.spent_usd.toFixed(2)} <span className="text-sm text-muted-foreground">/ ${b.cap_usd}</span></div>
                <div className="w-full bg-muted h-1.5 rounded mt-2 overflow-hidden">
                  <div className={`h-full ${danger ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${Math.min(100, b.pct)}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{b.pct}% used</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Enrichment KPIs */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Enrichment Throughput (last 20 runs)</h2>
        {kpis.length === 0 ? (
          <div className="text-xs text-muted-foreground">No KPI rows yet — first run will populate after next enrichment cycle.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b">
              <tr><th className="text-left py-1">When</th><th className="text-left">Function</th><th className="text-right">Att</th><th className="text-right">Enriched</th><th className="text-right">Failed</th><th className="text-right">Skipped</th><th className="text-right">/hr</th><th className="text-right">$</th></tr>
            </thead>
            <tbody>
              {kpis.map((k, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1">{new Date(k.run_at).toLocaleTimeString()}</td>
                  <td className="font-mono">{k.function_name}</td>
                  <td className="text-right">{k.leads_attempted}</td>
                  <td className="text-right text-emerald-500">{k.leads_enriched}</td>
                  <td className="text-right text-destructive">{k.leads_failed}</td>
                  <td className="text-right">{k.leads_skipped}</td>
                  <td className="text-right">{Math.round(k.throughput_per_hour || 0)}</td>
                  <td className="text-right">${((k.cost_cents_total || 0) / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Allocation preview */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Rebalancer Allocation</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs">Target:</label>
            <input
              type="number" min={1} value={target}
              onChange={(e) => setTarget(Number(e.target.value) || FLOOR)}
              className="bg-background border border-border px-2 py-0.5 rounded w-20 text-sm"
            />
            <Button size="sm" variant="outline" onClick={previewAllocation} disabled={busy === "preview"}>
              {busy === "preview" ? "..." : "Preview"}
            </Button>
            <Button size="sm" onClick={runRebalancer} disabled={busy === "rebalance"}>
              {busy === "rebalance" ? "Sending…" : "Run Live"}
            </Button>
          </div>
        </div>
        {planMeta && (
          <div className="text-sm mb-2 text-muted-foreground">
            Sent today: <strong>{planMeta.sentToday}</strong> • Gap to target: <strong>{planMeta.gap}</strong> • Target: <strong>{planMeta.target}</strong>
          </div>
        )}
        {plan && plan.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr><th className="text-left py-1">Sender</th><th className="text-left">Pool</th><th className="text-right">Available</th><th className="text-right">Planned Send</th></tr>
            </thead>
            <tbody>
              {plan.map((p) => (
                <tr key={p.fn} className="border-b">
                  <td className="py-1 font-mono text-xs">{p.fn}</td>
                  <td>{p.pool}</td>
                  <td className="text-right">{p.available}</td>
                  <td className="text-right font-bold">{p.planned_send}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-xs text-muted-foreground">Click Preview to see how the rebalancer would split the next {target}-send batch across senders.</div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-4">14-Day Volume vs {target} Target</h2>
        <div className="flex items-end gap-2 h-48">
          {days.map((d) => {
            const pct = (d.count / max) * 100;
            const under = d.count < target;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px]">{d.count}</div>
                <div
                  className={`w-full rounded-t ${under ? "bg-destructive" : "bg-primary"}`}
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
                <div className="text-[10px] text-muted-foreground">{d.date.slice(5)}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Red bars = under target/day</div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-4">Today by Template</h2>
        {today.length === 0 && <div className="text-sm text-muted-foreground">No cold emails sent today yet.</div>}
        <div className="space-y-1">
          {today.map((t) => (
            <div key={t.template} className="flex justify-between text-sm border-b py-1">
              <span className="font-mono text-xs">{t.template}</span>
              <span className="font-bold">{t.count}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Senders & Trial Verification</h2>
          <Button onClick={runSentinel} disabled={busy === "sentinel"}>
            {busy === "sentinel" ? "Running..." : `Force ${target} Top-Off`}
          </Button>
        </div>
        <div className="space-y-2">
          {SENDERS.map((s) => (
            <div key={s.fn} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground font-mono">{s.fn}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={s.trial.includes("30") ? "secondary" : "default"}>{s.trial}</Badge>
                <Button size="sm" onClick={() => runFn(s.fn)} disabled={busy === s.fn}>
                  {busy === s.fn ? "..." : "Run Now"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Offer Standardization (Locked)</h2>
        <ul className="text-sm space-y-1 list-disc pl-5">
          <li>Hiring radars (TechAlert / CareAlert / Talent / Hire) → <strong>30-day</strong> trial, no CC</li>
          <li>All other monthly products → <strong>7-day</strong> trial, no CC, <strong>+ 50% off first 3 months</strong></li>
          <li>Suppression + dedup enforced via <code>email_suppression_unified</code> view</li>
          <li>Free-first enrichment waterfall: Google Places → Firecrawl → Hunter → Apollo</li>
        </ul>
      </Card>
    </div>
  );
}
