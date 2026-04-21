import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Contractor {
  id: string;
  business_name: string;
  email: string;
  phone: string;
  trade: string;
  city: string;
  active: boolean | null;
  onboarded_at: string | null;
  roi_token: string | null;
  free_dead_leads_quota: number;
  created_at: string;
  stripe_customer_id: string | null;
}

interface WelcomeLog {
  id: string;
  contractor_id: string;
  message_index: number;
  status: string;
  twilio_sid: string | null;
  twilio_status: string | null;
  twilio_error_code: string | null;
  error_message: string | null;
  created_at: string;
}

interface AuditRow {
  id: string;
  contractor_id: string | null;
  outcome: string;
  reason: string | null;
  stripe_event_id: string | null;
  stripe_event_type: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  delivered: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  sent:      "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
  queued:    "bg-amber-500/20 text-amber-400 border-amber-500/40",
  failed:    "bg-red-500/20 text-red-400 border-red-500/40",
  skipped:   "bg-white/10 text-white/60 border-white/20",
};

const TWILIO_STATUS_LABEL: Record<string, string> = {
  queued: "queued @ Twilio",
  sending: "sending",
  sent: "sent",
  delivered: "delivered ✓",
  undelivered: "undelivered ✗",
  failed: "failed ✗",
};

export default function AdminContractorOnboarding() {
  const [list, setList] = useState<Contractor[]>([]);
  const [logs, setLogs] = useState<Record<string, WelcomeLog[]>>({});
  const [audits, setAudits] = useState<Record<string, AuditRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("contractor_clients")
      .select("id, business_name, email, phone, trade, city, active, onboarded_at, roi_token, free_dead_leads_quota, created_at, stripe_customer_id")
      .order("created_at", { ascending: false })
      .limit(50);
    const contractors = ((data as any[]) || []) as Contractor[];
    setList(contractors);

    const ids = contractors.map((c) => c.id);
    if (ids.length) {
      const [{ data: logRows }, { data: auditRows }] = await Promise.all([
        (supabase as any).from("contractor_welcome_log")
          .select("id, contractor_id, message_index, status, twilio_sid, twilio_status, twilio_error_code, error_message, created_at")
          .in("contractor_id", ids)
          .order("created_at", { ascending: false }),
        (supabase as any).from("contractor_provisioning_audit")
          .select("id, contractor_id, outcome, reason, stripe_event_id, stripe_event_type, created_at")
          .in("contractor_id", ids)
          .order("created_at", { ascending: false }),
      ]);
      const logMap: Record<string, WelcomeLog[]> = {};
      ((logRows as any[]) || []).forEach((r) => {
        (logMap[r.contractor_id] ||= []).push(r as WelcomeLog);
      });
      setLogs(logMap);
      const auditMap: Record<string, AuditRow[]> = {};
      ((auditRows as any[]) || []).forEach((r) => {
        if (r.contractor_id) (auditMap[r.contractor_id] ||= []).push(r as AuditRow);
      });
      setAudits(auditMap);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function checkReadiness(c: Contractor): { ready: boolean; reason?: string } {
    if (!c.stripe_customer_id) return { ready: false, reason: "⏳ Waiting for Stripe payment — no contractor_clients row provisioned yet (or manual insert without stripe_customer_id). Welcome SMS blocked." };
    if (c.active === false) return { ready: false, reason: "⛔ Contractor marked inactive." };
    if (!c.phone) return { ready: false, reason: "⚠️ Phone missing on contractor row." };
    return { ready: true };
  }

  async function fireWelcome(id: string, idx: number, attempted_by = "admin_retry") {
    const c = list.find((x) => x.id === id);
    if (c) {
      const r = checkReadiness(c);
      if (!r.ready) { alert(r.reason); return; }
    }
    setBusyId(id + idx);
    try {
      const { data, error } = await (supabase.functions as any).invoke("contractor-welcome-sequence", {
        body: { contractor_id: id, message_index: idx, attempted_by },
      });
      if (error) throw error;
      if ((data as any)?.error) {
        alert(`Blocked: ${(data as any).message || (data as any).error}`);
        return;
      }
      if ((data as any)?.duplicate) {
        alert(`Already sent — message #${idx + 1} was previously dispatched (idempotency guard).`);
      } else {
        alert(`Sent welcome message #${idx + 1}`);
      }
      await load();
    } catch (e: any) {
      alert(`Failed: ${e?.message || e}`);
    } finally { setBusyId(null); }
  }

  async function retryWhenReady(c: Contractor) {
    setBusyId(c.id + "retry");
    try {
      // Re-fetch fresh row to see if stripe_customer_id has appeared since list load
      const { data: fresh } = await (supabase as any)
        .from("contractor_clients")
        .select("id, stripe_customer_id, active, phone")
        .eq("id", c.id)
        .maybeSingle();
      if (!fresh?.stripe_customer_id) {
        alert("Still waiting on Stripe — stripe_customer_id is not set yet. Try again in a minute.");
        return;
      }
      // Fresh row is good — fire welcome 0 (idempotency guard prevents duplicates)
      await fireWelcome(c.id, 0, "admin_retry");
    } finally { setBusyId(null); }
  }

  async function generateKeywords(c: Contractor) {
    setBusyId(c.id + "kw");
    try {
      const { data, error } = await (supabase.functions as any).invoke("google-ads-keyword-builder", {
        body: { trade: c.trade, city: c.city, business_name: c.business_name },
      });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${c.business_name}-google-ads.json`;
      a.click();
    } catch (e: any) {
      alert(`Failed: ${e?.message || e}`);
    } finally { setBusyId(null); }
  }

  function bestLogForSlot(contractorId: string, slot: number): WelcomeLog | null {
    const all = logs[contractorId] || [];
    const matches = all.filter((l) => l.message_index === slot);
    if (matches.length === 0) return null;
    // Prefer terminal success, else latest
    return matches.find((m) => m.status === "delivered")
      || matches.find((m) => m.status === "sent")
      || matches[0];
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">🤝 New Contractor Onboarding</h1>
        <p className="text-white/50 text-sm mt-1">Walk new contractors through setup. Each box = 10-min check.</p>
      </div>

      {loading && <div className="text-white/50">Loading…</div>}

      <div className="space-y-3">
        {list.map((c) => {
          const portalUrl = `https://detroitwebagent.com/contractor-portal/${c.roi_token || c.id}`;
          const intakeUrl = `https://detroitwebagent.com/dead-lead-intake?cid=${c.id}`;
          const statusUrl = `https://detroitwebagent.com/contractor-onboarding-status?contractor_id=${c.id}`;
          const readiness = checkReadiness(c);
          const stripeOk = !!c.stripe_customer_id;
          const cAudits = audits[c.id] || [];
          const lastAudit = cAudits[0];
          return (
            <div key={c.id} className="bg-[#0d1f3c] border border-white/10 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-white">{c.business_name}</div>
                  <div className="text-white/50 text-xs">{c.trade} · {c.city} · {c.email} · {c.phone}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${readiness.ready ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                  {readiness.ready ? "Ready" : "Blocked"}
                </span>
              </div>

              {!readiness.ready && (
                <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded p-2 text-xs text-amber-300 flex items-center justify-between gap-2">
                  <span>{readiness.reason}</span>
                  {!stripeOk && (
                    <button
                      onClick={() => retryWhenReady(c)}
                      disabled={busyId === c.id + "retry"}
                      className="bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 font-bold py-1 px-2 rounded text-[11px] whitespace-nowrap disabled:opacity-50"
                      title="Re-checks contractor row; if stripe_customer_id is now present, queues welcome SMS #1"
                    >
                      ↻ Retry when ready
                    </button>
                  )}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-[#0a1628] rounded p-2 text-white/60">
                  {stripeOk ? "✅ Stripe payment cleared" : "⏳ Stripe payment pending — no webhook provisioning yet"}
                </div>
                <div className="bg-[#0a1628] rounded p-2 text-white/60">
                  📍 Trade + city: {c.trade} / {c.city}
                </div>
                <div className="bg-[#0a1628] rounded p-2 text-white/60 truncate">
                  🔗 Portal: <a href={portalUrl} className="text-[#00d4ff]">{portalUrl}</a>
                </div>
                <div className="bg-[#0a1628] rounded p-2 text-white/60 truncate">
                  ♻️ Intake: <a href={intakeUrl} className="text-[#00d4ff]">{intakeUrl}</a>
                </div>
                <div className="bg-[#0a1628] rounded p-2 text-white/60 truncate sm:col-span-2">
                  📊 Public status page: <a href={statusUrl} target="_blank" rel="noreferrer" className="text-[#00d4ff]">{statusUrl}</a>
                </div>
              </div>

              {/* Welcome SMS delivery state per slot */}
              <div className="mt-3 bg-[#0a1628] rounded p-2 border border-white/5">
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Welcome SMS delivery</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[0, 1, 2].map((slot) => {
                    const log = bestLogForSlot(c.id, slot);
                    const cls = log ? STATUS_COLOR[log.status] || "bg-white/10 text-white/60 border-white/20" : "bg-white/5 text-white/40 border-white/10";
                    const label = log
                      ? (TWILIO_STATUS_LABEL[log.twilio_status || ""] || log.status)
                      : "not sent";
                    return (
                      <div key={slot} className={`border rounded px-2 py-1 ${cls}`}>
                        <div className="text-[10px] uppercase opacity-70">#{slot + 1}</div>
                        <div className="font-mono text-[11px] truncate" title={log?.error_message || log?.twilio_sid || ""}>
                          {label}
                        </div>
                        {log?.twilio_error_code && (
                          <div className="text-[10px] opacity-70">err {log.twilio_error_code}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Provisioning audit trail */}
              {lastAudit && (
                <div className="mt-3 bg-[#0a1628] rounded p-2 border border-white/5 text-xs">
                  <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Provisioning audit</div>
                  <div className="text-white/70">
                    <span className="font-mono">{lastAudit.outcome}</span>
                    {lastAudit.stripe_event_id && (
                      <span className="text-white/40 ml-2 font-mono text-[10px]">{lastAudit.stripe_event_id}</span>
                    )}
                  </div>
                  {lastAudit.reason && <div className="text-white/50 mt-1">{lastAudit.reason}</div>}
                  {cAudits.length > 1 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-white/40 text-[10px]">+ {cAudits.length - 1} earlier event(s)</summary>
                      <ul className="mt-1 space-y-1">
                        {cAudits.slice(1).map((a) => (
                          <li key={a.id} className="text-white/50 text-[11px]">
                            <span className="font-mono">{a.outcome}</span> · {a.stripe_event_id || "no-event"} · {new Date(a.created_at).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => fireWelcome(c.id, 0)} disabled={busyId === c.id + 0} className="bg-[#00d4ff] text-[#0a1628] font-bold py-1 px-3 rounded text-xs disabled:opacity-50">Send Welcome 1</button>
                <button onClick={() => fireWelcome(c.id, 1)} disabled={busyId === c.id + 1} className="bg-white/10 text-white py-1 px-3 rounded text-xs disabled:opacity-50">Send Welcome 2</button>
                <button onClick={() => fireWelcome(c.id, 2)} disabled={busyId === c.id + 2} className="bg-white/10 text-white py-1 px-3 rounded text-xs disabled:opacity-50">Send Welcome 3</button>
                <button onClick={() => generateKeywords(c)} disabled={busyId === c.id + "kw"} className="bg-emerald-500/20 text-emerald-400 py-1 px-3 rounded text-xs disabled:opacity-50">📋 Generate Google Ads</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
