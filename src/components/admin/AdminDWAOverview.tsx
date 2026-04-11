import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExternalLink, Wrench, Users, Bell, Play, RefreshCw, Zap } from "lucide-react";
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
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [invoking, setInvoking] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [
      { count: fdCount },
      { count: haCount },
      { data: lastRun },
      { count: candCount },
      { count: hotCount },
    ] = await Promise.all([
      (supabase as any).from("field_crm_clients").select("id", { count: "exact", head: true }).eq("status", "active"),
      (supabase as any).from("hire_alert_clients").select("id", { count: "exact", head: true }).eq("active", true),
      (supabase as any).from("hire_alert_runs").select("*").order("run_at", { ascending: false }).limit(1),
      (supabase as any).from("hire_alert_candidates").select("id", { count: "exact", head: true }),
      (supabase as any).from("hire_alert_candidates").select("id", { count: "exact", head: true }).eq("status", "alerted"),
    ]);
    setStats({
      fieldDeskClients: fdCount || 0,
      techAlertClients: haCount || 0,
      lastRunAt: lastRun?.[0]?.run_at || null,
      lastRunCandidates: lastRun?.[0]?.candidates_found || 0,
      totalCandidates: candCount || 0,
      hotCandidates: hotCount || 0,
    });
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
    { label: "DJ Conley Demo", href: "/demo-djconley-v2", color: "#ec4899" },
  ];

  const STAT_CARDS = [
    { label: "FieldDesk Clients", value: stats.fieldDeskClients, color: "#00d4ff", icon: Users },
    { label: "TechAlert Clients", value: stats.techAlertClients, color: "#f59e0b", icon: Bell },
    { label: "Candidates in DB", value: stats.totalCandidates, color: "#10b981", icon: Users },
    { label: "Alerts Sent (hot)", value: stats.hotCandidates, color: "#ef4444", icon: Zap },
  ];

  return (
    <div className="space-y-6 p-1">
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
          <Button onClick={invokeScanner} disabled={invoking}
            className="bg-orange-500 hover:bg-orange-600 text-white">
            <Play size={13} className="mr-1.5" />
            {invoking ? "Running..." : "Invoke Scanner Now"}
          </Button>
        </div>
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
