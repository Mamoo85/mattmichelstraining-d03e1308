import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, MessageSquareOff, Clock, AlertTriangle, Loader2 } from "lucide-react";

interface ComplianceStats {
  window_days: number;
  sms_sent_7d: number;
  opt_outs_7d: number;
  opt_outs_total: number;
  blocks_7d_total: number;
  blocks_by_reason: Record<string, number>;
  recent_blocks: Array<{
    phone_masked: string;
    product: string;
    reason: string;
    created_at: string;
  }>;
  generated_at: string;
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  quiet_hours: { label: "Quiet Hours (8pm–8am local)", color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  sms_opt_out: { label: "STOP / Opt-Out", color: "text-rose-400 border-rose-400/30 bg-rose-400/10" },
  invalid_e164_us_only: { label: "Invalid US Number", color: "text-violet-400 border-violet-400/30 bg-violet-400/10" },
  unknown: { label: "Unknown", color: "text-white/60 border-white/20 bg-white/5" },
};

export default function AdminComplianceMonitor() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<ComplianceStats>({
    queryKey: ["compliance-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("compliance-stats");
      if (error) throw error;
      return data as ComplianceStats;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-white/60 p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading TCPA / 10DLC compliance posture…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200">
        Failed to load compliance stats: {error instanceof Error ? error.message : "unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-[#00d4ff]" />
            TCPA / 10DLC Compliance Monitor
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Last 7 days · auto-refresh every 60s · {new Date(data.generated_at).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2 rounded-lg bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 border border-[#00d4ff]/40 text-[#00d4ff] text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<MessageSquareOff className="h-5 w-5" />}
          label="SMS Sent (7d)"
          value={data.sms_sent_7d.toLocaleString()}
          tone="emerald"
        />
        <KpiCard
          icon={<MessageSquareOff className="h-5 w-5" />}
          label="STOP Replies (7d)"
          sub={`${data.opt_outs_total.toLocaleString()} all-time`}
          value={data.opt_outs_7d.toLocaleString()}
          tone="rose"
        />
        <KpiCard
          icon={<Clock className="h-5 w-5" />}
          label="Quiet-Hours Blocks (7d)"
          value={(data.blocks_by_reason.quiet_hours || 0).toLocaleString()}
          tone="amber"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Total Blocks (7d)"
          value={data.blocks_7d_total.toLocaleString()}
          tone="violet"
        />
      </div>

      {/* Compliance Posture Summary */}
      <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
        <h2 className="text-white/80 text-sm font-semibold uppercase tracking-wide mb-3">
          Active Protections
        </h2>
        <ul className="space-y-2 text-sm text-white/70">
          <li className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span><strong>EBR Window:</strong> 18-month TCPA cutoff enforced on Dead Lead campaigns</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span><strong>STOP Scrubbing:</strong> Every send checks <code className="px-1 rounded bg-white/10 text-xs">sms_opt_outs</code> table before dispatch</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span><strong>A2P 10DLC:</strong> +13139921219 registered (Low Volume Mixed, approved April 2026)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span><strong>Quiet Hours:</strong> 8am–9pm recipient local time (timezone derived from area code)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span><strong>US-Only:</strong> Strict E.164 validation rejects non-US numbers (international = different consent regime)</span>
          </li>
        </ul>
      </div>

      {/* Recent Blocks Table */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white/80 text-sm font-semibold uppercase tracking-wide">
            Recent Compliance Blocks
          </h2>
          <span className="text-xs text-white/40">last 50 · phone numbers masked</span>
        </div>
        {data.recent_blocks.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            No compliance blocks recorded. Pipeline is clean.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/50 text-xs uppercase tracking-wide border-b border-white/10">
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_blocks.map((b, i) => {
                  const r = REASON_LABELS[b.reason] || REASON_LABELS.unknown;
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-white/60 text-xs whitespace-nowrap">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 font-mono text-white/70 text-xs">{b.phone_masked}</td>
                      <td className="px-5 py-3 text-white/70 text-xs">{b.product}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${r.color}`}>
                          {r.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: "emerald" | "rose" | "amber" | "violet";
}) {
  const toneMap = {
    emerald: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
    rose: "text-rose-400 border-rose-400/30 bg-rose-400/5",
    amber: "text-amber-400 border-amber-400/30 bg-amber-400/5",
    violet: "text-violet-400 border-violet-400/30 bg-violet-400/5",
  };
  return (
    <div className={`p-5 rounded-xl border ${toneMap[tone]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-bold mt-2 text-white">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  );
}
