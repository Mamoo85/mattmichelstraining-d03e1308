import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface HealthData {
  pending: number;
  enriched: number;
  exhausted: number;
  stuck: number; // pending > 2h
  lastRunISO: string | null;
  apiFailures24h: number;
}

export function EnrichmentHealthStrip() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      const [pendingRes, enrichedRes, exhaustedRes, stuckRes, lastRunRes, failRes] = await Promise.all([
        (supabase as any).from("hire_alert_candidates").select("id", { count: "exact", head: true }).eq("enrichment_status", "pending"),
        // Table uses status value 'complete' (not 'enriched') — see migration history.
        (supabase as any).from("hire_alert_candidates").select("id", { count: "exact", head: true }).eq("enrichment_status", "complete"),
        (supabase as any).from("hire_alert_candidates").select("id", { count: "exact", head: true }).eq("enrichment_status", "exhausted"),
        (supabase as any).from("hire_alert_candidates").select("id", { count: "exact", head: true })
          .eq("enrichment_status", "pending").lt("first_seen_at", twoHoursAgo),
        // Scanner writes started_at on every run; run_at is legacy/nullable.
        (supabase as any).from("hire_alert_runs").select("started_at").order("started_at", { ascending: false }).limit(1),
        (supabase as any).from("system_comms_log").select("id", { count: "exact", head: true })
          .in("product", ["pdl_enrichment", "sonar_enrichment", "npi_enrichment"])
          .eq("status", "error").gte("created_at", dayAgo),
      ]);

      setData({
        pending: pendingRes.count || 0,
        enriched: enrichedRes.count || 0,
        exhausted: exhaustedRes.count || 0,
        stuck: stuckRes.count || 0,
        lastRunISO: lastRunRes.data?.[0]?.started_at || null,
        apiFailures24h: failRes.count || 0,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(t);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading enrichment health…
      </div>
    );
  }

  // Health verdict
  const critical = data.stuck > 50 || data.apiFailures24h > 20;
  const warn = data.stuck > 10 || data.apiFailures24h > 5;
  const verdictColor = critical ? "#ef4444" : warn ? "#f59e0b" : "#10b981";
  const VerdictIcon = critical ? AlertTriangle : warn ? AlertTriangle : CheckCircle2;
  const verdictText = critical ? "CRITICAL" : warn ? "WARN" : "HEALTHY";

  const lastRun = data.lastRunISO
    ? `${Math.round((Date.now() - new Date(data.lastRunISO).getTime()) / 60000)}m ago`
    : "never";

  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-lg border"
      style={{ borderColor: `${verdictColor}40`, background: `${verdictColor}08` }}
    >
      <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: verdictColor }}>
        <VerdictIcon className="h-4 w-4" /> {verdictText}
      </div>
      <div className="h-4 w-px bg-white/10" />
      <Pill label="Pending" value={data.pending} color="#f59e0b" />
      <Pill label="Enriched" value={data.enriched} color="#10b981" />
      <Pill label="Exhausted" value={data.exhausted} color="#64748b" />
      <Pill label="Stuck >2h" value={data.stuck} color={data.stuck > 0 ? "#ef4444" : "#64748b"} />
      <Pill label="API errors 24h" value={data.apiFailures24h} color={data.apiFailures24h > 0 ? "#ef4444" : "#64748b"} />
      <div className="ml-auto flex items-center gap-1.5 text-[11px] text-white/40">
        <Activity className="h-3 w-3" /> Last scan: {lastRun}
      </div>
    </div>
  );
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="text-white/40">{label}</span>
      <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: `${color}20`, color }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export default EnrichmentHealthStrip;
