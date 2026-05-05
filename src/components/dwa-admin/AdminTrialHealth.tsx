import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Mail, MessageSquare } from "lucide-react";

interface TrialRow {
  id: string;
  customer_email: string;
  product_slug: string;
  trial_started_at: string;
  trial_ends_at: string;
  promised_leads_per_week: number;
  leads_delivered: number;
  sla_status: string;
  welcome_pulse_sent_at: string | null;
  day2_pulse_sent_at: string | null;
  day5_pulse_sent_at: string | null;
  day6_pulse_sent_at: string | null;
}

interface TouchRow {
  id: string;
  trial_sla_id: string | null;
  customer_email: string;
  touch_type: string;
  channel: string;
  body_preview: string | null;
  delivery_status: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

const StatusBadge = ({ s }: { s: string }) => {
  const map: Record<string, string> = {
    on_track: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    at_risk: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    breached: "bg-red-500/20 text-red-300 border-red-500/40",
  };
  return <span className={`px-2 py-0.5 rounded text-xs border ${map[s] || "bg-white/10 text-white/60 border-white/20"}`}>{s}</span>;
};

const DeliveryDot = ({ s }: { s: string | null }) => {
  if (!s) return <span className="text-white/40">—</span>;
  const ok = ["sent", "delivered", "queued", "ok"].includes(s.toLowerCase());
  const fail = ["failed", "error", "bounced", "suppressed"].includes(s.toLowerCase());
  const cls = ok ? "text-emerald-300" : fail ? "text-red-300" : "text-amber-300";
  return <span className={`text-xs font-mono ${cls}`}>{s}</span>;
};

const ChannelIcon = ({ ch }: { ch: string }) => {
  if (ch === "sms") return <MessageSquare className="h-3 w-3 inline text-[#00d4ff]" />;
  return <Mail className="h-3 w-3 inline text-[#00d4ff]" />;
};

const TOUCH_LABELS: Record<string, string> = {
  welcome_pulse: "Day 0 — Welcome",
  day2_pulse: "Day 2 — Check-in",
  day5_pulse: "Day 5 — Mid-trial value",
  day6_pulse: "Day 6 — Convert ask",
  at_risk_alert: "At-Risk admin alert",
  breach_alert: "Breach admin alert",
};

export default function AdminTrialHealth() {
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [touches, setTouches] = useState<Record<string, TouchRow[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("trial_delivery_sla" as any)
      .select("*")
      .order("trial_ends_at", { ascending: true })
      .limit(200);
    setRows((data as unknown as TrialRow[]) || []);
    setLoading(false);
  };

  const loadTouches = async (trialId: string, email: string) => {
    const { data } = await supabase
      .from("trial_concierge_log" as any)
      .select("*")
      .or(`trial_sla_id.eq.${trialId},customer_email.eq.${email}`)
      .order("created_at", { ascending: false })
      .limit(50);
    setTouches(t => ({ ...t, [trialId]: (data as unknown as TouchRow[]) || [] }));
  };

  const toggleRow = async (r: TrialRow) => {
    const isOpen = !!expanded[r.id];
    setExpanded(e => ({ ...e, [r.id]: !isOpen }));
    if (!isOpen && !touches[r.id]) await loadTouches(r.id, r.customer_email);
  };

  const runWatchdog = async () => {
    setRunning(true);
    await supabase.functions.invoke("trial-sla-watchdog");
    await load();
    setTouches({});
    setRunning(false);
  };

  useEffect(() => { load(); }, []);

  const breached = rows.filter(r => r.sla_status === "breached").length;
  const atRisk = rows.filter(r => r.sla_status === "at_risk").length;
  const onTrack = rows.filter(r => r.sla_status === "on_track").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#00d4ff]" /> Trial Health (7-Day SLA)
        </h2>
        <button
          onClick={runWatchdog}
          disabled={running}
          className="px-3 py-1.5 bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40 rounded text-xs font-semibold disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Run Watchdog Now"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded p-3">
          <div className="text-xs text-white/60 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> On Track</div>
          <div className="text-2xl font-bold text-emerald-300">{onTrack}</div>
        </div>
        <div className="border border-amber-500/30 bg-amber-500/5 rounded p-3">
          <div className="text-xs text-white/60 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> At Risk</div>
          <div className="text-2xl font-bold text-amber-300">{atRisk}</div>
        </div>
        <div className="border border-red-500/30 bg-red-500/5 rounded p-3">
          <div className="text-xs text-white/60 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Breached</div>
          <div className="text-2xl font-bold text-red-300">{breached}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-white/40 text-sm border border-white/10 rounded p-6 text-center">
          No active trials yet. New 7-day trials will appear here automatically.
        </div>
      ) : (
        <div className="border border-white/10 rounded overflow-hidden">
          <table className="w-full text-xs text-white/80">
            <thead className="bg-white/5 text-white/60 uppercase">
              <tr>
                <th className="w-6 px-2 py-2"></th>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Delivered</th>
                <th className="text-right px-3 py-2">Promised/wk</th>
                <th className="text-left px-3 py-2">Pulses</th>
                <th className="text-right px-3 py-2">Ends</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map(r => {
                const isOpen = !!expanded[r.id];
                const log = touches[r.id] || [];
                return (
                  <>
                    <tr key={r.id} className="hover:bg-white/5 cursor-pointer" onClick={() => toggleRow(r)}>
                      <td className="px-2 py-2 text-white/40">
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </td>
                      <td className="px-3 py-2 font-mono">{r.customer_email}</td>
                      <td className="px-3 py-2">{r.product_slug}</td>
                      <td className="px-3 py-2"><StatusBadge s={r.sla_status} /></td>
                      <td className="px-3 py-2 text-right">{r.leads_delivered}</td>
                      <td className="px-3 py-2 text-right">{r.promised_leads_per_week}</td>
                      <td className="px-3 py-2 text-white/50 font-mono">
                        <span className={r.welcome_pulse_sent_at ? "text-emerald-300" : ""}>W</span>
                        <span className={r.day2_pulse_sent_at ? "text-emerald-300" : ""}>2</span>
                        <span className={r.day5_pulse_sent_at ? "text-emerald-300" : ""}>5</span>
                        <span className={r.day6_pulse_sent_at ? "text-emerald-300" : ""}>6</span>
                      </td>
                      <td className="px-3 py-2 text-right text-white/60">{new Date(r.trial_ends_at).toLocaleDateString()}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.id}-log`} className="bg-black/30">
                        <td></td>
                        <td colSpan={7} className="px-3 py-3">
                          <div className="text-[11px] uppercase tracking-widest text-white/50 mb-2">
                            Touchpoint Log ({log.length})
                          </div>
                          {log.length === 0 ? (
                            <div className="text-white/40 text-xs italic">No touchpoints recorded yet for this trial.</div>
                          ) : (
                            <div className="border border-white/10 rounded overflow-hidden">
                              <table className="w-full text-[11px]">
                                <thead className="bg-white/5 text-white/50 uppercase">
                                  <tr>
                                    <th className="text-left px-2 py-1.5">When</th>
                                    <th className="text-left px-2 py-1.5">Touch</th>
                                    <th className="text-left px-2 py-1.5">Ch</th>
                                    <th className="text-left px-2 py-1.5">Status</th>
                                    <th className="text-left px-2 py-1.5">Preview</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {log.map(t => (
                                    <tr key={t.id}>
                                      <td className="px-2 py-1.5 text-white/60 font-mono whitespace-nowrap">
                                        {new Date(t.created_at).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-1.5">
                                        {TOUCH_LABELS[t.touch_type] || t.touch_type}
                                      </td>
                                      <td className="px-2 py-1.5"><ChannelIcon ch={t.channel} /></td>
                                      <td className="px-2 py-1.5"><DeliveryDot s={t.delivery_status} /></td>
                                      <td className="px-2 py-1.5 text-white/70 max-w-md truncate">
                                        {t.body_preview || <span className="text-white/30">—</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
