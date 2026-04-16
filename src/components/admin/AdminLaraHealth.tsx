import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Activity, Wifi, WifiOff } from "lucide-react";

interface LaraHealthEntry {
  id: string;
  status: string;
  http_status: number | null;
  response_bytes: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  fallback_activated: boolean;
  fallback_sources: string[] | null;
  candidates_from_fallback: number;
  checked_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  ok: { color: "#22c55e", icon: CheckCircle, label: "Healthy" },
  blocked: { color: "#f97316", icon: Shield, label: "Blocked" },
  down: { color: "#ef4444", icon: XCircle, label: "Down" },
  captcha: { color: "#f97316", icon: Shield, label: "CAPTCHA" },
  timeout: { color: "#eab308", icon: Clock, label: "Timeout" },
  format_changed: { color: "#dc2626", icon: AlertTriangle, label: "FORMAT CHANGED" },
};

export default function AdminLaraHealth() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["lara-health"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lara_health_log")
        .select("*")
        .order("checked_at", { ascending: false })
        .limit(50);
      return (data || []) as LaraHealthEntry[];
    },
    refetchInterval: 60_000,
  });

  const latest = entries?.[0];
  const last7 = entries?.slice(0, 14) || []; // ~7 days at 2x/day
  const okCount = last7.filter(e => e.status === "ok").length;
  const failCount = last7.length - okCount;
  const uptime = last7.length > 0 ? Math.round((okCount / last7.length) * 100) : 100;
  const avgResponseTime = last7.filter(e => e.response_time_ms).reduce((sum, e) => sum + (e.response_time_ms || 0), 0) / (last7.filter(e => e.response_time_ms).length || 1);

  if (isLoading) {
    return (
      <div className="p-6 text-center text-white/40">
        <Activity className="w-5 h-5 animate-spin mx-auto mb-2" />
        Loading LARA health data...
      </div>
    );
  }

  if (!entries?.length) {
    return (
      <div className="p-6 text-center text-white/40">
        <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No LARA health data yet. Runs after next scanner execution.</p>
      </div>
    );
  }

  const latestConfig = STATUS_CONFIG[latest?.status || "ok"] || STATUS_CONFIG.ok;
  const LatestIcon = latestConfig.icon;

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="flex items-center gap-4 p-4 rounded-lg" style={{ background: `${latestConfig.color}10`, border: `1px solid ${latestConfig.color}30` }}>
        <LatestIcon className="w-8 h-8 flex-shrink-0" style={{ color: latestConfig.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black uppercase tracking-wider" style={{ color: latestConfig.color }}>
              {latestConfig.label}
            </span>
            {latest?.fallback_activated && (
              <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-bold">
                FALLBACKS ACTIVE
              </span>
            )}
          </div>
          <p className="text-white/50 text-xs mt-1">
            Last check: {latest ? new Date(latest.checked_at).toLocaleString() : "—"}
            {latest?.response_time_ms ? ` · ${latest.response_time_ms}ms` : ""}
            {latest?.http_status ? ` · HTTP ${latest.http_status}` : ""}
          </p>
          {latest?.error_message && (
            <p className="text-red-400/70 text-xs mt-1 truncate">{latest.error_message}</p>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "7-Day Uptime", value: `${uptime}%`, color: uptime >= 80 ? "#22c55e" : uptime >= 50 ? "#eab308" : "#ef4444" },
          { label: "Avg Response", value: `${Math.round(avgResponseTime)}ms`, color: avgResponseTime < 3000 ? "#22c55e" : "#f97316" },
          { label: "OK Checks", value: `${okCount}/${last7.length}`, color: "#00d4ff" },
          { label: "Failures", value: `${failCount}`, color: failCount === 0 ? "#22c55e" : "#ef4444" },
        ].map(k => (
          <div key={k.label} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
            <div className="text-lg font-black" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div>
        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Recent Health Checks</h4>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {entries.map((entry) => {
            const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.ok;
            const Icon = cfg.icon;
            return (
              <div key={entry.id} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-white/5 transition-colors">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg.color }} />
                <span className="text-xs font-mono text-white/50 w-36 flex-shrink-0">
                  {new Date(entry.checked_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="text-xs font-bold flex-shrink-0 w-16" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
                <span className="text-xs text-white/30 flex-shrink-0 w-14">
                  {entry.response_time_ms ? `${entry.response_time_ms}ms` : "—"}
                </span>
                <span className="text-xs text-white/30 flex-shrink-0 w-12">
                  {entry.http_status ? `HTTP ${entry.http_status}` : ""}
                </span>
                {entry.fallback_activated && (
                  <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-bold">
                    FALLBACK
                  </span>
                )}
                {entry.error_message && (
                  <span className="text-xs text-red-400/50 truncate flex-1 min-w-0" title={entry.error_message}>
                    {entry.error_message.substring(0, 60)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Health Status Bar (visual uptime) */}
      <div>
        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Uptime (last 14 checks)</h4>
        <div className="flex gap-1">
          {last7.map((entry) => {
            const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.ok;
            return (
              <div
                key={entry.id}
                className="flex-1 h-6 rounded-sm"
                style={{ background: cfg.color }}
                title={`${new Date(entry.checked_at).toLocaleString()} — ${cfg.label}`}
              />
            );
          })}
          {last7.length === 0 && (
            <div className="flex-1 h-6 rounded-sm bg-white/10" />
          )}
        </div>
      </div>
    </div>
  );
}
