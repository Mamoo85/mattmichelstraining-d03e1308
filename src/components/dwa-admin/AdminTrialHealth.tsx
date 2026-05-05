import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Mail, MessageSquare } from "lucide-react";

interface TrialRow {
  id: string;
  email: string;
  phone: string | null;
  product_key: string;
  stripe_subscription_id: string | null;
  trial_started_at: string;
  trial_ends_at: string;
  status: string;
  first_lead_delivered_at: string | null;
  lead_count_d1: number;
  lead_count_d2: number;
  lead_count_d3: number;
  lead_count_d4: number;
  lead_count_d5: number;
  lead_count_d6: number;
  lead_count_d7: number;
  sla_status: string;
  compensation_applied_at: string | null;
  last_concierge_touch_at: string | null;
}

interface DripRow {
  id: string;
  trial_signup_id: string;
  touch_key: string;
  channel: string;
  status: string;
  error: string | null;
  sent_at: string;
  meta: Record<string, unknown> | null;
}

const PRODUCT_MIN_D3: Record<string, number> = {
  trade_radar: 3, mortgage_radar: 2, contractor: 2, talent_radar: 1, hire_alert: 1,
};

function family(pk: string): string {
  if (pk?.startsWith("trade_radar")) return "trade_radar";
  if (pk?.startsWith("mortgage_radar")) return "mortgage_radar";
  if (pk?.includes("contractor")) return "contractor";
  if (pk?.includes("talent") || pk?.includes("hire_alert")) return "talent_radar";
  return pk;
}

const SlaBadge = ({ s }: { s: string }) => {
  const map: Record<string, string> = {
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    yellow: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    red: "bg-red-500/20 text-red-300 border-red-500/40",
  };
  const icon = s === "green" ? "🟢" : s === "yellow" ? "🟡" : "🔴";
  return <span className={`px-2 py-0.5 rounded text-xs border ${map[s] || "bg-white/10 text-white/60 border-white/20"}`}>{icon} {s}</span>;
};

const TOUCH_LABELS: Record<string, string> = {
  day2: "Day 2 — Check-in",
  day4_comp: "Day 4 — Auto-compensation",
  day5: "Day 5 — Mid-trial",
  day6: "Day 6 — Convert ask",
};

export default function AdminTrialHealth() {
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [drips, setDrips] = useState<Record<string, DripRow[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("trial_signups")
      .select("*")
      .eq("status", "active")
      .order("trial_ends_at", { ascending: true })
      .limit(200);
    setRows((data as unknown as TrialRow[]) || []);
    setLoading(false);
  };

  const loadDrips = async (id: string) => {
    const { data } = await supabase
      .from("trial_drip_state")
      .select("*")
      .eq("trial_signup_id", id)
      .order("sent_at", { ascending: false });
    setDrips((p) => ({ ...p, [id]: (data as unknown as DripRow[]) || [] }));
  };

  const toggle = async (id: string) => {
    const next = !expanded[id];
    setExpanded((p) => ({ ...p, [id]: next }));
    if (next && !drips[id]) await loadDrips(id);
  };

  const runDrip = async () => {
    setRunning(true);
    try {
      await supabase.functions.invoke("trial-drip-runner");
      await load();
    } finally { setRunning(false); }
  };

  useEffect(() => { void load(); }, []);

  const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#00d4ff]" />
            Trial Health — Live SLA Tracking
          </h2>
          <p className="text-xs text-white/50 mt-1">All active trials with daily lead counts, SLA status, and concierge touch log.</p>
        </div>
        <button
          onClick={runDrip}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40 text-sm font-semibold hover:bg-[#00d4ff]/30 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run drip now"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm">No active trials.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => {
            const days = daysSince(t.trial_started_at);
            const sumD123 = t.lead_count_d1 + t.lead_count_d2 + t.lead_count_d3;
            const min = PRODUCT_MIN_D3[family(t.product_key)] ?? 2;
            const total = t.lead_count_d1 + t.lead_count_d2 + t.lead_count_d3 + t.lead_count_d4 + t.lead_count_d5 + t.lead_count_d6 + t.lead_count_d7;
            return (
              <div key={t.id} className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg">
                <button
                  onClick={() => toggle(t.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-[#1e3a5f]/30 transition-colors"
                >
                  <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                    {expanded[t.id] ? <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-white/40 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">{t.email}</span>
                        <span className="text-[10px] uppercase tracking-wider text-white/50">{t.product_key}</span>
                        <SlaBadge s={t.sla_status} />
                        {t.compensation_applied_at && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">+7d ext</span>}
                      </div>
                      <div className="text-[11px] text-white/40 mt-1">
                        Day {days} of 7 · {total} leads total · D1–D3: {sumD123}/{min} · {t.first_lead_delivered_at ? `1st lead: ${new Date(t.first_lead_delivered_at).toLocaleString()}` : "no leads yet"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-white/40 flex-shrink-0">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                      const cnt = (t as any)[`lead_count_d${d}`] || 0;
                      return <span key={d} className={`px-1.5 py-0.5 rounded border ${cnt > 0 ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : "bg-white/5 text-white/30 border-white/10"}`}>D{d}:{cnt}</span>;
                    })}
                  </div>
                </button>
                {expanded[t.id] && (
                  <div className="px-3 pb-3 pt-1 border-t border-[#1e3a5f]/40">
                    <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Concierge touches</div>
                    {drips[t.id] === undefined ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white/30" />
                    ) : drips[t.id].length === 0 ? (
                      <div className="text-xs text-white/40">No touches recorded yet.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {drips[t.id].map((d) => (
                          <div key={d.id} className="flex items-start gap-2 text-xs bg-[#030711] border border-[#1e3a5f]/40 rounded p-2">
                            {d.channel === "sms" ? <MessageSquare className="h-3 w-3 text-[#00d4ff] mt-0.5 flex-shrink-0" /> : <Mail className="h-3 w-3 text-[#00d4ff] mt-0.5 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{TOUCH_LABELS[d.touch_key] || d.touch_key}</span>
                                <span className="text-white/40">{new Date(d.sent_at).toLocaleString()}</span>
                                {d.status === "sent" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3 text-red-400" />}
                              </div>
                              {d.error && <div className="text-red-300 text-[11px] mt-0.5">{d.error}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
