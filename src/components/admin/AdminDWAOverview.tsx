import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExternalLink, Wrench, Users, Bell, Play, RefreshCw, Zap, Activity } from "lucide-react";
import { toast } from "sonner";

export default function AdminDWAOverview() {
  const [stats, setStats] = useState({
    fieldDeskClients: 0,
    techAlertClients: 0,
    lastRunAt: null as string | null,
    lastRunCandidates: 0,
    totalCandidates: 0,
    hotCandidates: 0,
  });
  const [healthChecks, setHealthChecks] = useState<Array<{ api_name: string; status: string; response_ms: number; error_message: string | null; checked_at: string }>>([]);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [invoking, setInvoking] = useState(false);
  const [sendingTrial, setSendingTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pdlTesting, setPdlTesting] = useState(false);
  const [pdlResult, setPdlResult] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    setLoading(true);
    const [
      { count: fdCount },
      { count: haCount },
      { data: lastRun },
      { count: candCount },
      { count: hotCount },
      { data: healthData },
    ] = await Promise.all([
      (supabase as any).from("field_crm_clients").select("id", { count: "exact", head: true }).eq("status", "active"),
      (supabase as any).from("hire_alert_clients").select("id", { count: "exact", head: true }).eq("active", true),
      (supabase as any).from("hire_alert_runs").select("*").order("run_at", { ascending: false }).limit(1),
      (supabase as any).from("hire_alert_candidates").select("id", { count: "exact", head: true }),
      (supabase as any).from("hire_alert_candidates").select("id", { count: "exact", head: true }).eq("status", "alerted"),
      (supabase as any).from("api_health_checks").select("api_name, status, response_ms, error_message, checked_at").order("checked_at", { ascending: false }).limit(30),
    ]);
    setStats({
      fieldDeskClients: fdCount || 0,
      techAlertClients: haCount || 0,
      lastRunAt: lastRun?.[0]?.run_at || null,
      lastRunCandidates: lastRun?.[0]?.candidates_found || 0,
      totalCandidates: candCount || 0,
      hotCandidates: hotCount || 0,
    });
    // Deduplicate: show latest check per API
    if (healthData) {
      const seen = new Set<string>();
      const deduped = healthData.filter((h: any) => {
        if (seen.has(h.api_name)) return false;
        seen.add(h.api_name);
        return true;
      });
      setHealthChecks(deduped);
    }
    setLoading(false);
  };

  const runTest = async (product: string) => {
    setTesting(t => ({ ...t, [product]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("create-test-checkout", { body: { product } });
      if (error || !data?.url) throw new Error(error?.message || "No checkout URL");
      window.location.href = data.url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Test failed");
      setTesting(t => ({ ...t, [product]: false }));
    }
  };

  const testPDL = async () => {
    setPdlTesting(true);
    setPdlResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-candidate-phones", {
        body: { action: "test_pdl", use_db_candidate: true },
      });
      if (error) throw error;
      setPdlResult(data);
      const s = data?.upgrade_summary;
      if (s) {
        toast.success(`PDL hit: ${s.phones_available} phones, ${s.emails_available} emails, ${s.jobs_in_history} jobs, ${s.certs_found} certs`);
      } else {
        toast.error("PDL returned no match — try with a specific name");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "PDL test failed");
    } finally {
      setPdlTesting(false);
    }
  };

  const sendMockTrialEmails = async () => {
    setSendingTrial(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-mock-trial-emails");
      if (error) throw error;
      toast.success("✅ 5 mock trial emails sent to matt@mattmichelstraining.com");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSendingTrial(false);
    }
  };

  const invokeScanner = async () => {
    setInvoking(true);
    try {
      const { error } = await supabase.functions.invoke("hire-alert-scanner");
      if (error) throw error;
      toast.success("Scanner running — check your email in ~60 seconds");
      setTimeout(load, 5000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Invoke failed");
    } finally {
      setInvoking(false);
    }
  };

  useEffect(() => { load(); }, []);

  const QUICK_LINKS = [
    { label: "FieldDesk Landing", href: "/field-service", color: "#00d4ff" },
    { label: "TechAlert Landing", href: "/hire-alert", color: "#f59e0b" },
    { label: "Dispatcher Board", href: "/field-service/dispatch", color: "#10b981" },
    { label: "Tech Mobile App", href: "/field-service/tech", color: "#8b5cf6" },
    { label: "DWA Admin", href: "/dwa-admin", color: "#e8621a" },
    { label: "DJ Conley Demo", href: "/demo-djconley-2", color: "#ec4899" },
  ];

  const CUSTOMER_VIEWS = [
    { label: "📊 Contractor Dashboard (example)", href: "/contractor-portal/preview", color: "#00d4ff", note: "Contractor Leads clients see this — replace 'preview' with their roi_token" },
    { label: "🏠 Mortgage Radar Dashboard (example)", href: "/my-mortgage-radar?email=test@example.com", color: "#6366f1", note: "Mortgage Radar clients see this — replace email with client email" },
    { label: "🔧 TechAlert Dashboard (example)", href: "/my-tech-alert", color: "#f59e0b", note: "TechAlert clients see this after login" },
    { label: "🏗️ FieldDesk Dispatch (example)", href: "/field-service/dispatch?demo=1", color: "#10b981", note: "FieldDesk clients see this — demo mode shows sample jobs" },
    { label: "📈 Contractor ROI Report (example)", href: "/roi?token=REPLACE_WITH_ROI_TOKEN", color: "#22c55e", note: "Texted to contractors weekly on Fridays" },
  ];

  const STAT_CARDS = [
    { label: "FieldDesk Clients", value: stats.fieldDeskClients, color: "#00d4ff", icon: Users },
    { label: "TechAlert Clients", value: stats.techAlertClients, color: "#f59e0b", icon: Bell },
    { label: "Candidates in DB", value: stats.totalCandidates, color: "#10b981", icon: Users },
    { label: "Alerts Sent (hot)", value: stats.hotCandidates, color: "#ef4444", icon: Zap },
  ];

  const mrrGoal = 5000;
  const mrrStart = new Date("2026-04-23").getTime();
  const mrrEnd = new Date("2026-07-22").getTime();
  const now = Date.now();
  const totalDays = Math.round((mrrEnd - mrrStart) / 86_400_000);
  const elapsed = Math.min(totalDays, Math.round((now - mrrStart) / 86_400_000));
  const daysLeft = Math.max(0, totalDays - elapsed);
  const pctTime = elapsed / totalDays;

  const [currentMrr, setCurrentMrr] = useState(0);
  useEffect(() => {
    (supabase as any)
      .from("service_subscriptions")
      .select("monthly_price")
      .eq("status", "active")
      .then(({ data }: { data: Array<{ monthly_price: number | null }> | null }) => {
        if (data) setCurrentMrr(data.reduce((s, r) => s + (r.monthly_price || 0), 0));
      });
  }, []);

  const mrrPct = Math.min(100, Math.round((currentMrr / mrrGoal) * 100));
  const onPace = currentMrr / mrrGoal >= pctTime;
  const barColor = daysLeft <= 30 && mrrPct < 25 ? "#ef4444" : onPace ? "#22c55e" : "#f59e0b";

  return (
    <div className="space-y-6 p-1">
      {/* Quick links */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href="https://supabase.com/dashboard/project/eauvubfpanpeuxsrqesu"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg,#00d4ff,#0891b2)",
            color: "#0a1628", padding: "10px 16px", borderRadius: 8,
            fontWeight: 800, fontSize: 13, textDecoration: "none",
            boxShadow: "0 4px 12px rgba(0,212,255,0.3)",
          }}
        >
          <ExternalLink size={14} /> Open Supabase Dashboard (Primary)
        </a>
        <a
          href="https://supabase.com/dashboard/project/zmyczlfuufhngzovkjdh"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#1e3a5f", color: "#e2e8f0",
            padding: "10px 16px", borderRadius: 8,
            fontWeight: 700, fontSize: 13, textDecoration: "none",
            border: "1px solid #334155",
          }}
        >
          <ExternalLink size={14} /> Secondary Project
        </a>
      </div>

      {/* 90-day revenue clock */}
      <div style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <p style={{ margin: 0, color: "#00d4ff", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>90-Day Revenue Clock</p>
          <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>{daysLeft} days left · ends Jul 22</p>
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Current MRR</p>
            <p style={{ margin: 0, color: "#ffffff", fontSize: 26, fontWeight: 900 }}>${currentMrr.toLocaleString()}</p>
          </div>
          <div>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Goal</p>
            <p style={{ margin: 0, color: "#ffffff", fontSize: 26, fontWeight: 900 }}>${mrrGoal.toLocaleString()}</p>
          </div>
          <div>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Remaining</p>
            <p style={{ margin: 0, color: barColor, fontSize: 26, fontWeight: 900 }}>${Math.max(0, mrrGoal - currentMrr).toLocaleString()}</p>
          </div>
        </div>
        <div style={{ background: "#1e3a5f", borderRadius: 6, height: 8, overflow: "hidden" }}>
          <div style={{ width: `${mrrPct}%`, height: "100%", background: barColor, borderRadius: 6, transition: "width 0.6s ease" }} />
        </div>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 11 }}>{mrrPct}% of goal · Day {elapsed} of {totalDays}</p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white text-xl font-black flex items-center gap-2">
            <Wrench size={20} className="text-cyan-400" />
            Detroit Web Agency — Command Center
          </h2>
          <p className="text-white/40 text-sm mt-0.5">Test, launch, and monitor all DWA products.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}
          className="border-white/15 text-white/60 hover:text-white">
          <RefreshCw size={13} className="mr-1" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl border p-4"
            style={{ background: `${color}0d`, borderColor: `${color}25` }}>
            <Icon size={16} style={{ color }} className="mb-2" />
            <div className="text-2xl font-black text-white">{loading ? "—" : value}</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Free Taste Funnel — sneak peek signups & trial conversions */}
      <FreeTasteFunnelRow />

      {/* Quick Links */}
      <div>
        <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">Quick Links</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.map(({ label, href, color }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
              style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
              <ExternalLink size={11} />
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* Customer Dashboard Previews */}
      <div style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: 12, padding: "20px 24px" }}>
        <p style={{ margin: "0 0 4px", color: "#00d4ff", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>What Your Customers See</p>
        <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 12 }}>Click any link below to preview exactly what each product's dashboard looks like to a paying client.</p>
        <div className="flex flex-col gap-3">
          {CUSTOMER_VIEWS.map(({ label, href, color, note }) => (
            <div key={href} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", borderRadius: 8, background: `${color}08`, border: `1px solid ${color}20` }}>
              <a href={href} target="_blank" rel="noopener noreferrer"
                style={{ color, fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                <ExternalLink size={12} />
                {label}
              </a>
              <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* $0 Test Checkouts */}
      <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
        <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-4">$0 Test Checkouts</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <p className="text-white font-bold text-sm mb-1">FieldDesk — Field Service Management</p>
            <p className="text-white/40 text-xs mb-3">
              Dispatch board, GPS tracking, mobile tech app, auto-SMS workflows. $199/mo
            </p>
            <Button size="sm" onClick={() => runTest("field_service_subscription")}
              disabled={testing["field_service_subscription"]}
              className="w-full text-xs"
              style={{ background: "rgba(0,212,255,0.15)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.3)" }}>
              {testing["field_service_subscription"] ? "Launching..." : "Launch $0 Test Checkout"}
            </Button>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-white font-bold text-sm mb-1">TechAlert — Hiring Monitor</p>
            <p className="text-white/40 text-xs mb-3">
              Daily MIOSHA license DB + Apollo + job board scan. Alerts when licensed techs go available. $49-99/mo
            </p>
            <Button size="sm" onClick={() => runTest("hire_alert_subscription")}
              disabled={testing["hire_alert_subscription"]}
              className="w-full text-xs"
              style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
              {testing["hire_alert_subscription"] ? "Launching..." : "Launch $0 Test Checkout"}
            </Button>
          </div>
        </div>
      </div>

      {/* Scanner Control */}
      <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
        <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">TechAlert Scanner Control</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-white text-sm font-semibold">
              Last run:{" "}
              <span className="text-white/60 font-normal">
                {stats.lastRunAt ? new Date(stats.lastRunAt).toLocaleString() : "Never"}
              </span>
            </p>
            <p className="text-white/40 text-xs mt-0.5">
              Found {stats.lastRunCandidates} candidates last run · {stats.hotCandidates} hot alerts sent total ·
              Cron: daily 7am ET
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={invokeScanner} disabled={invoking}
              className="bg-orange-500 hover:bg-orange-600 text-white">
              <Play size={13} className="mr-1.5" />
              {invoking ? "Running..." : "Invoke Scanner Now"}
            </Button>
            <Button onClick={testPDL} disabled={pdlTesting}
              className="bg-violet-600 hover:bg-violet-700 text-white">
              <Zap size={13} className="mr-1.5" />
              {pdlTesting ? "Testing PDL..." : "Test PDL Premium"}
            </Button>
            <Button onClick={sendMockTrialEmails} disabled={sendingTrial}
              className="bg-purple-600 hover:bg-purple-700 text-white">
              <Bell size={13} className="mr-1.5" />
              {sendingTrial ? "Sending..." : "Send Mock Trial Emails"}
            </Button>
          </div>
        </div>
      </div>

      {/* PDL Test Result */}
      {pdlResult && (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5">
          <p className="text-violet-400 text-xs font-bold uppercase tracking-wider mb-3">
            PDL Premium Result — {String(pdlResult.tested_name)} ({String(pdlResult.tested_city)})
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-xs mb-4">
            <div>
              <p className="text-white/50 font-bold mb-2">Free Tier Was Returning</p>
              <pre className="text-green-400/80 text-[11px] leading-5 whitespace-pre-wrap">
                {JSON.stringify(pdlResult.free_tier_fields, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-white/50 font-bold mb-2">Premium Now Adds</p>
              <pre className="text-violet-300/80 text-[11px] leading-5 whitespace-pre-wrap">
                {JSON.stringify(pdlResult.upgrade_summary, null, 2)}
              </pre>
              {(pdlResult.premium_additions as any)?.certifications?.length > 0 && (
                <div className="mt-2">
                  <p className="text-white/40 mb-1">Certifications found:</p>
                  <p className="text-amber-400 text-[11px]">
                    {((pdlResult.premium_additions as any).certifications as string[]).join(", ")}
                  </p>
                </div>
              )}
              {(pdlResult.premium_additions as any)?.skills?.length > 0 && (
                <div className="mt-2">
                  <p className="text-white/40 mb-1">Skills:</p>
                  <p className="text-cyan-400 text-[11px]">
                    {((pdlResult.premium_additions as any).skills as string[]).slice(0, 8).join(", ")}
                  </p>
                </div>
              )}
              {(pdlResult.premium_additions as any)?.inferred_salary && (
                <div className="mt-2">
                  <p className="text-white/40 mb-1">Inferred salary:</p>
                  <p className="text-emerald-400 text-[11px] font-bold">
                    {String((pdlResult.premium_additions as any).inferred_salary)}
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="text-white/20 text-[10px]">
            Match likelihood: {String(pdlResult.pdl_match_likelihood ?? "n/a")} / 10 ·
            Free fields hit: {String(pdlResult.free_tier_hit_count)} ·
            Premium additions: {String(pdlResult.premium_addition_hit_count)}
          </p>
        </div>
      )}

      {/* Pipeline Health */}
      <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/50 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <Activity size={13} className="text-cyan-400" />
            Pipeline Health — Data Sources
          </p>
          {healthChecks.length > 0 && (
            <span className="text-xs font-bold" style={{
              color: healthChecks.every(h => h.status === "ok") ? "#22c55e" : "#f59e0b"
            }}>
              {healthChecks.filter(h => h.status === "ok").length}/{healthChecks.length} operational
            </span>
          )}
        </div>
        {healthChecks.length === 0 ? (
          <p className="text-white/30 text-xs">No health checks yet. Monitor runs at 6am + 6pm ET daily.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {healthChecks.map((h) => {
              const color = h.status === "ok" ? "#22c55e" : h.status === "degraded" ? "#f59e0b" : "#ef4444";
              return (
                <div key={h.api_name} className="rounded-lg p-3" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-[10px] font-bold text-white/80 truncate">{h.api_name}</span>
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color }}>{h.response_ms}ms</div>
                  {h.error_message && (
                    <div className="text-[9px] text-red-400/70 truncate mt-0.5">{h.error_message}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {healthChecks.length > 0 && (
          <p className="text-white/20 text-[10px] mt-3">
            Last checked: {new Date(healthChecks[0]?.checked_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Product Brief */}
      <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
        <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-4">DWA Product Suite</p>
        <div className="grid sm:grid-cols-3 gap-4 text-xs text-white/50">
          <div>
            <p className="text-cyan-400 font-bold mb-1">FieldDesk — $199/mo</p>
            <p>Replaces eWay CRM ($27-40/user/mo). Dispatch board, GPS map, mobile tech app, auto-SMS on every status change.</p>
          </div>
          <div>
            <p className="text-amber-400 font-bold mb-1">TechAlert — $49-99/mo</p>
            <p>Scans Michigan MIOSHA license DB daily. New license issued = new tech entering the market. No other tool does this.</p>
          </div>
          <div>
            <p className="text-emerald-400 font-bold mb-1">Contractor Leads — $399/mo</p>
            <p>Exclusive territory lead gen. Homeowner fills form on SEO page, contractor gets SMS + email within minutes. 7-day free trial.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Free Taste Funnel ─────────────────────────────────────────────────────
// Counts sneak-peek signups (last 7d) per product and shows conversion %.
function FreeTasteFunnelRow() {
  const [rows, setRows] = useState<Array<{ product: string; signups: number; converted: number; color: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { count: buyerPeeks } = await (supabase as any)
        .from("buyer_radar_custom_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "sneak_peek")
        .gte("created_at", since);

      const { count: demandPeeks } = await (supabase as any)
        .from("capture_submissions")
        .select("id", { count: "exact", head: true })
        .ilike("source_url", "%demand-radar-preview%")
        .gte("created_at", since);

      const { count: talentPeeks } = await (supabase as any)
        .from("hire_alert_clients")
        .select("id", { count: "exact", head: true })
        .eq("trial_active", true)
        .gte("created_at", since);

      const { count: buyerConv } = await (supabase as any)
        .from("buyer_radar_custom_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "converted")
        .gte("created_at", since);

      const { count: demandConv } = await (supabase as any)
        .from("industry_pulse_clients")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);

      const { count: talentConv } = await (supabase as any)
        .from("hire_alert_clients")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .gte("created_at", since);

      setRows([
        { product: "Buyer Radar",  signups: buyerPeeks || 0,  converted: buyerConv || 0,  color: "#00d4ff" },
        { product: "Demand Radar", signups: demandPeeks || 0, converted: demandConv || 0, color: "#a78bfa" },
        { product: "Talent Radar", signups: talentPeeks || 0, converted: talentConv || 0, color: "#f59e0b" },
      ]);
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <p style={{ margin: 0, color: "#00d4ff", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Free Taste Funnel · Last 7 Days</p>
        <p style={{ margin: 0, color: "#64748b", fontSize: 11 }}>Sneak peeks → paid conversions</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {rows.map((r) => {
          const pct = r.signups > 0 ? Math.round((r.converted / r.signups) * 100) : 0;
          return (
            <div key={r.product} style={{ background: `${r.color}0d`, border: `1px solid ${r.color}25`, borderRadius: 10, padding: 14 }}>
              <p style={{ margin: 0, color: r.color, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{r.product}</p>
              <div style={{ display: "flex", gap: 16, alignItems: "baseline", marginTop: 6 }}>
                <div>
                  <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{loading ? "—" : r.signups}</div>
                  <div style={{ color: "#94a3b8", fontSize: 10 }}>signups</div>
                </div>
                <div>
                  <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{loading ? "—" : r.converted}</div>
                  <div style={{ color: "#94a3b8", fontSize: 10 }}>paid</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <div style={{ color: pct >= 10 ? "#22c55e" : pct > 0 ? "#f59e0b" : "#64748b", fontSize: 18, fontWeight: 900 }}>{pct}%</div>
                  <div style={{ color: "#94a3b8", fontSize: 10 }}>conv.</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
