// AdminContractorLeadsStatus — End-to-end health page for the contractor leads
// pipeline. KPIs, contractors, sites, cron jobs, last outbound per recipient
// (with one-click ↻ Resend → ResendSmsModal).

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ResendSmsModal, { type ResendTarget } from "./ResendSmsModal";

interface Kpi {
  active_contractors: number;
  total_contractors: number;
  total_sites: number;
  leads_7d: number;
  leads_30d: number;
  leads_all_time: number;
  contractors_with_billing: number;
}

interface ContractorRow {
  id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  trade: string | null;
  city: string | null;
  active: boolean;
  billing_active: boolean;
  dead_lead_billing_active: boolean;
  sites_count: number;
  leads_7d: number;
  leads_30d: number;
  last_outbound_at: string | null;
}

interface SiteRow {
  id: string;
  contractor_id: string | null;
  contractor_name: string;
  trade: string | null;
  city: string | null;
  state: string | null;
  active: boolean | null;
  leads_7d: number;
  leads_30d: number;
}

interface CronRow {
  jobname: string;
  last_success_at: string | null;
  last_run_at: string | null;
  last_error: string | null;
  status: string | null;
  expected_interval_minutes: number | null;
  stale_after_minutes: number | null;
  next_run_at: string | null;
}

interface OutboundRow {
  message_id: string;
  recipient: string;
  product: string | null;
  body: string;
  body_full_stored: boolean;
  sent_at: string;
}

interface Payload {
  generated_at: string;
  kpi: Kpi;
  contractors: ContractorRow[];
  sites: SiteRow[];
  cron_health: CronRow[];
  last_outbound: OutboundRow[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function cronHealthDot(c: CronRow): { color: string; label: string } {
  if (!c.last_success_at) return { color: "bg-white/30", label: "no data" };
  const ageMin = (Date.now() - new Date(c.last_success_at).getTime()) / 60_000;
  const stale = c.stale_after_minutes ?? 1560;
  if (ageMin > stale) return { color: "bg-red-500", label: "stale" };
  if (ageMin > stale * 0.7) return { color: "bg-amber-400", label: "warming" };
  return { color: "bg-emerald-400", label: "healthy" };
}

export default function AdminContractorLeadsStatus() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [resendTarget, setResendTarget] = useState<ResendTarget | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("contractor-leads-status", {
        body: {},
      });
      if (error) throw error;
      setData(res as Payload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredContractors = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.contractors;
    return data.contractors.filter((c) =>
      [c.business_name, c.email, c.phone, c.trade, c.city]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, filter]);

  if (loading && !data) {
    return <div className="text-white/40 text-sm p-6">Loading contractor leads status…</div>;
  }
  if (!data) {
    return (
      <div className="p-6 text-white/60 text-sm">
        Failed to load.{" "}
        <button onClick={load} className="underline text-[#00d4ff]">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">🟢 Contractor Leads — End-to-End Status</h2>
          <p className="text-white/50 text-xs mt-1">
            Last refreshed {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 disabled:opacity-50"
        >
          <span className={loading ? "inline-block animate-spin mr-1" : "inline-block mr-1"}>↻</span>
          Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi label="Active contractors" value={`${data.kpi.active_contractors}/${data.kpi.total_contractors}`} />
        <Kpi label="Sites" value={data.kpi.total_sites} />
        <Kpi label="Leads 7d" value={data.kpi.leads_7d} />
        <Kpi label="Leads 30d" value={data.kpi.leads_30d} />
        <Kpi label="Leads all-time" value={data.kpi.leads_all_time} />
        <Kpi label="With billing" value={data.kpi.contractors_with_billing} />
        <Kpi label="Cron jobs tracked" value={data.cron_health.length} />
      </div>

      {/* Cron health */}
      <section>
        <h3 className="text-sm font-bold text-white/80 mb-2">Cron health</h3>
        <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-white/40 text-left">
              <tr>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Last success</th>
                <th className="px-3 py-2">Expected interval</th>
                <th className="px-3 py-2">Last error</th>
              </tr>
            </thead>
            <tbody>
              {data.cron_health.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-3 text-white/40">No cron data yet — sentinel hasn't run for these jobs.</td></tr>
              )}
              {data.cron_health.map((c) => {
                const dot = cronHealthDot(c);
                return (
                  <tr key={c.jobname} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${dot.color}`} title={dot.label} />
                    </td>
                    <td className="px-3 py-2 font-mono text-white/80">{c.jobname}</td>
                    <td className="px-3 py-2 text-white/60">{timeAgo(c.last_success_at)}</td>
                    <td className="px-3 py-2 text-white/60">
                      {c.expected_interval_minutes ? `${c.expected_interval_minutes}m` : "—"}
                    </td>
                    <td className="px-3 py-2 text-red-300/80 truncate max-w-xs">{c.last_error ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Contractors */}
      <section>
        <div className="flex items-center justify-between mb-2 gap-3">
          <h3 className="text-sm font-bold text-white/80">Contractors</h3>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name / city / phone"
            className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-white text-xs w-64 focus:outline-none focus:border-[#00d4ff]"
          />
        </div>
        <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-white/40 text-left">
              <tr>
                <th className="px-3 py-2">Business</th>
                <th className="px-3 py-2">Trade · City</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Sites</th>
                <th className="px-3 py-2">Leads 7d</th>
                <th className="px-3 py-2">Leads 30d</th>
                <th className="px-3 py-2">Last outbound</th>
                <th className="px-3 py-2">Billing</th>
              </tr>
            </thead>
            <tbody>
              {filteredContractors.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white/90">{c.business_name}</td>
                  <td className="px-3 py-2 text-white/60">{c.trade ?? "—"} · {c.city ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-white/70">{c.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-white/60">{c.sites_count}</td>
                  <td className="px-3 py-2 text-white/80 font-semibold">{c.leads_7d}</td>
                  <td className="px-3 py-2 text-white/60">{c.leads_30d}</td>
                  <td className="px-3 py-2 text-white/60">{timeAgo(c.last_outbound_at)}</td>
                  <td className="px-3 py-2">
                    {c.billing_active ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">card on file</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">no card</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredContractors.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-3 text-white/40">No contractors match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sites */}
      <section>
        <h3 className="text-sm font-bold text-white/80 mb-2">Sites ({data.sites.length})</h3>
        <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-white/40 text-left sticky top-0 bg-[#0f1f33]">
              <tr>
                <th className="px-3 py-2">Contractor</th>
                <th className="px-3 py-2">Trade</th>
                <th className="px-3 py-2">City, ST</th>
                <th className="px-3 py-2">Leads 7d</th>
                <th className="px-3 py-2">Leads 30d</th>
                <th className="px-3 py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {data.sites.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white/80">{s.contractor_name}</td>
                  <td className="px-3 py-2 text-white/60">{s.trade ?? "—"}</td>
                  <td className="px-3 py-2 text-white/60">{s.city ?? "—"}{s.state ? `, ${s.state}` : ""}</td>
                  <td className="px-3 py-2 text-white/80 font-semibold">{s.leads_7d}</td>
                  <td className="px-3 py-2 text-white/60">{s.leads_30d}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${s.active ? "bg-emerald-400" : "bg-white/20"}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Last outbound per recipient */}
      <section>
        <h3 className="text-sm font-bold text-white/80 mb-2">Last outbound per recipient</h3>
        <div className="border border-white/10 rounded-lg bg-white/[0.02] divide-y divide-white/5 max-h-96 overflow-y-auto">
          {data.last_outbound.length === 0 && (
            <div className="p-3 text-white/40 text-xs">No recent outbound SMS.</div>
          )}
          {data.last_outbound.map((m) => (
            <div key={m.message_id} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
                  <span className="font-mono text-[#00d4ff]">{m.recipient}</span>
                  <span>·</span>
                  <span>{m.product ?? "—"}</span>
                  <span>·</span>
                  <span>{timeAgo(m.sent_at)}</span>
                  {!m.body_full_stored && (
                    <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">preview only</span>
                  )}
                </div>
                <div className="text-xs text-white/80 whitespace-pre-wrap break-words line-clamp-2">{m.body}</div>
              </div>
              <button
                onClick={() =>
                  setResendTarget({
                    message_id: m.message_id,
                    recipient: m.recipient,
                    body: m.body,
                    product: m.product,
                    sent_at: m.sent_at,
                    body_full_stored: m.body_full_stored,
                  })
                }
                className="shrink-0 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/25"
                title="Resend with confirmation"
              >
                ↻ Resend
              </button>
            </div>
          ))}
        </div>
      </section>

      {resendTarget && (
        <ResendSmsModal
          target={resendTarget}
          onClose={() => setResendTarget(null)}
          onSent={() => load()}
        />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="text-white/50 text-[10px] uppercase tracking-wide">{label}</div>
      <div className="text-white text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}
