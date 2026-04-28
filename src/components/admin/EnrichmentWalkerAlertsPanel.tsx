import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, Bot, Bell, Loader2, Play, Gauge } from "lucide-react";

interface WalkerRun {
  id: string;
  trade: string;
  city: string;
  unenriched_count: number;
  attempted: number;
  succeeded: number;
  failed: number;
  cost_estimate_usd: number;
  skipped_reason: string | null;
  ran_at: string;
}
interface Latency {
  provider: string;
  sample_count: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  success_pct: number;
  last_sample_at: string;
}
interface Threshold {
  kind: string;
  warn_value: number;
  crit_value: number;
  sms_enabled: boolean;
  cooldown_minutes: number;
  description: string | null;
}
interface AlertRow {
  id: string;
  kind: string;
  severity: string;
  value: number | null;
  message: string;
  sms_sent: boolean;
  created_at: string;
  meta: any;
}
interface SpendRow { day: string; spend_usd: number; run_count: number; }

export default function EnrichmentWalkerAlertsPanel() {
  const [walkerRuns, setWalkerRuns] = useState<WalkerRun[]>([]);
  const [latency, setLatency] = useState<Latency[]>([]);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [spend, setSpend] = useState<SpendRow[]>([]);
  const [dailyBudget, setDailyBudget] = useState<number>(50);
  const [budgetInput, setBudgetInput] = useState<string>("50");
  const [savingBudget, setSavingBudget] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [w, l, t, a, s, c] = await Promise.all([
      (supabase as any).from("enrichment_walker_runs").select("*").order("ran_at", { ascending: false }).limit(20),
      (supabase as any).from("enrichment_provider_latency_live").select("*"),
      (supabase as any).from("enrichment_alert_thresholds").select("*").order("kind"),
      (supabase as any).from("outreach_alerts_log").select("*").order("created_at", { ascending: false }).limit(15),
      (supabase as any).from("enrichment_provider_spend_daily").select("*").limit(8),
      (supabase as any).from("enrichment_walker_config").select("value_numeric").eq("key", "daily_budget_usd").maybeSingle(),
    ]);
    setWalkerRuns(w.data ?? []);
    setLatency(l.data ?? []);
    setThresholds(t.data ?? []);
    setAlerts(a.data ?? []);
    setSpend(s.data ?? []);
    if (c.data?.value_numeric != null) {
      const v = Number(c.data.value_numeric);
      setDailyBudget(v);
      setBudgetInput(String(v));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function trigger(fn: "enrichment-matrix-walker" | "outreach-alert-evaluator") {
    setRunning(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: {} });
      if (error) throw error;
      toast.success(`${fn}: ${(data as any)?.skipped ?? "executed"}`);
      await load();
    } catch (e: any) {
      toast.error(`${fn} failed: ${e.message ?? e}`);
    } finally {
      setRunning(null);
    }
  }

  async function saveBudget() {
    const usd = Number(budgetInput);
    if (!Number.isFinite(usd) || usd < 0 || usd > 5000) {
      toast.error("Budget must be 0–5000");
      return;
    }
    setSavingBudget(true);
    try {
      const { error } = await (supabase as any).rpc("set_walker_daily_budget", { usd });
      if (error) throw error;
      toast.success(`Walker daily budget set to $${usd}`);
      setDailyBudget(usd);
    } catch (e: any) {
      toast.error(`Save failed: ${e.message ?? e}`);
    } finally {
      setSavingBudget(false);
    }
  }

  // Today's spend (Detroit-local) from the rollup view
  const todayET = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const todayRow = spend.find((r) => String(r.day) === todayET);
  const todaysSpend = Number(todayRow?.spend_usd ?? 0);
  const priorRows = spend.filter((r) => String(r.day) !== todayET).slice(0, 7);
  const avg7 = priorRows.length ? priorRows.reduce((s, r) => s + Number(r.spend_usd ?? 0), 0) / priorRows.length : 0;
  const budgetPct = Math.min(100, Math.round((todaysSpend / Math.max(dailyBudget, 0.01)) * 100));
  const anomalyRatio = avg7 >= 1 ? todaysSpend / avg7 : 0;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Loading walker &amp; alert telemetry…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Manual triggers */}
      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mr-2">Manual triggers:</span>
        <TriggerBtn icon={<Bot size={12} />} label="Run walker now" running={running === "enrichment-matrix-walker"} onClick={() => trigger("enrichment-matrix-walker")} />
        <TriggerBtn icon={<Bell size={12} />} label="Evaluate alerts" running={running === "outreach-alert-evaluator"} onClick={() => trigger("outreach-alert-evaluator")} />
        <button onClick={load} className="ml-auto text-[11px] text-cyan-300 hover:underline">Refresh</button>
      </div>

      {/* Wave 5: Today's walker spend + daily budget */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-2 mb-3">
          <Gauge size={14} className="text-cyan-300" /> Walker spend (today, ET)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Today</div>
            <div className="text-lg font-bold text-cyan-300">${todaysSpend.toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground">7-day avg ${avg7.toFixed(2)}{anomalyRatio >= 2 ? <span className="ml-1 text-rose-400 font-bold">⚠ {anomalyRatio.toFixed(1)}x</span> : null}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Budget cap</div>
            <div className="text-lg font-bold">${dailyBudget.toFixed(2)}</div>
            <div className="mt-1 h-1.5 w-full bg-border rounded overflow-hidden">
              <div
                className={budgetPct >= 100 ? "h-full bg-rose-500" : budgetPct >= 75 ? "h-full bg-amber-400" : "h-full bg-emerald-400"}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{budgetPct}% used</div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground">Set new daily cap (USD)</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                min={0}
                max={5000}
                step={5}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 text-xs w-24"
              />
              <button
                onClick={saveBudget}
                disabled={savingBudget}
                className="px-2 py-1 rounded text-[11px] font-bold bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
              >
                {savingBudget ? <Loader2 size={11} className="animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Provider latency */}
      <Section icon={<Gauge size={14} className="text-cyan-300" />} title="Provider latency (last 60 min)">
        {latency.length === 0 ? (
          <Empty msg="No latency samples in the last 60 minutes." />
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <Th>Provider</Th><Th>Samples</Th><Th>p50</Th><Th>p95</Th><Th>p99</Th><Th>Success %</Th>
              </tr>
            </thead>
            <tbody>
              {latency.map(r => (
                <tr key={r.provider} className="border-b border-border/40">
                  <Td><span className="font-mono text-cyan-300">{r.provider}</span></Td>
                  <Td>{r.sample_count}</Td>
                  <Td>{r.p50_ms} ms</Td>
                  <Td>{r.p95_ms} ms</Td>
                  <Td>{r.p99_ms} ms</Td>
                  <Td>
                    <span className={r.success_pct >= 90 ? "text-emerald-400" : r.success_pct >= 70 ? "text-amber-400" : "text-rose-400"}>
                      {r.success_pct ?? 0}%
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Walker runs */}
      <Section icon={<Activity size={14} className="text-cyan-300" />} title="Matrix walker — recent runs">
        {walkerRuns.length === 0 ? (
          <Empty msg="No walker runs yet. Trigger one above or wait for cron." />
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <Th>When</Th><Th>Pair</Th><Th>Backlog</Th><Th>Att</Th><Th>OK</Th><Th>Fail</Th><Th>$</Th><Th>Note</Th>
              </tr>
            </thead>
            <tbody>
              {walkerRuns.map(r => (
                <tr key={r.id} className="border-b border-border/40">
                  <Td>{new Date(r.ran_at).toLocaleString()}</Td>
                  <Td><span className="font-mono">{r.trade}/{r.city}</span></Td>
                  <Td>{r.unenriched_count}</Td>
                  <Td>{r.attempted}</Td>
                  <Td className="text-emerald-400">{r.succeeded}</Td>
                  <Td className={r.failed > 0 ? "text-rose-400" : ""}>{r.failed}</Td>
                  <Td>${Number(r.cost_estimate_usd).toFixed(2)}</Td>
                  <Td className="text-amber-400 text-[10px]">{r.skipped_reason ?? ""}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Thresholds */}
      <Section icon={<Bell size={14} className="text-cyan-300" />} title="Alert thresholds">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b border-border">
            <tr><Th>Metric</Th><Th>Warn</Th><Th>Crit</Th><Th>SMS</Th><Th>Cooldown</Th><Th>Description</Th></tr>
          </thead>
          <tbody>
            {thresholds.map(t => (
              <tr key={t.kind} className="border-b border-border/40">
                <Td><span className="font-mono text-cyan-300">{t.kind}</span></Td>
                <Td>{t.warn_value}</Td>
                <Td className="text-rose-400">{t.crit_value}</Td>
                <Td>{t.sms_enabled ? "✓" : "—"}</Td>
                <Td>{t.cooldown_minutes}m</Td>
                <Td className="text-[10px] text-muted-foreground">{t.description}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Recent alerts fired */}
      <Section icon={<Bell size={14} className="text-amber-400" />} title="Recent alerts fired">
        {alerts.length === 0 ? (
          <Empty msg="No alerts fired yet — system is quiet." />
        ) : (
          <ul className="space-y-1">
            {alerts.map(a => (
              <li key={a.id} className="text-xs flex items-start gap-2 border-b border-border/40 pb-1">
                <span className={a.severity === "crit" ? "text-rose-400 font-bold" : "text-amber-400 font-bold"}>
                  [{a.severity.toUpperCase()}]
                </span>
                <span className="font-mono text-cyan-300">{a.kind}</span>
                <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                <span className="ml-auto flex items-center gap-1">
                  {a.meta?.suppressed_by_quiet_hours ? <span title="Suppressed by quiet hours (9pm–7am ET)">🌙</span> : null}
                  {a.sms_sent ? "📱" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: any) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-2 mb-3">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}
function Th({ children }: any) { return <th className="text-left py-1.5 pr-2 font-medium">{children}</th>; }
function Td({ children, className = "" }: any) { return <td className={`py-1.5 pr-2 ${className}`}>{children}</td>; }
function Empty({ msg }: { msg: string }) { return <p className="text-xs text-muted-foreground italic">{msg}</p>; }
function TriggerBtn({ icon, label, running, onClick }: any) {
  return (
    <button
      onClick={onClick}
      disabled={running}
      className="px-3 py-1.5 rounded text-[11px] font-bold bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50 flex items-center gap-1.5"
    >
      {running ? <Loader2 size={12} className="animate-spin" /> : (icon ?? <Play size={12} />)} {label}
    </button>
  );
}
