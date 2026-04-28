import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Download, Filter, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  prospect_id: string | null;
  lead_id: string | null;
  channel: string;
  event: string;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  actor: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  prospect?: { business_name: string | null; trade: string | null; city: string | null } | null;
}

const EVENTS = [
  "sent", "opened", "clicked", "replied", "unsubscribed",
  "suppressed", "consent_granted", "consent_revoked",
  "quiet_hours_blocked", "daily_cap_blocked", "bounce",
];

const CHANNELS = ["email", "sms"];

const RANGE_OPTIONS = [
  { label: "Last 24h", hours: 24 },
  { label: "Last 7 days", hours: 24 * 7 },
  { label: "Last 30 days", hours: 24 * 30 },
];

export default function OutreachAuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState<string>("");
  const [filterEvent, setFilterEvent] = useState<string>("");
  const [filterActor, setFilterActor] = useState<string>("");
  const [rangeHours, setRangeHours] = useState<number>(24 * 7);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - rangeHours * 60 * 60 * 1000).toISOString();
    let q = (supabase as any)
      .from("contractor_outreach_audit_log")
      .select("*, prospect:contractor_outreach_prospects(business_name, trade, city)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (filterChannel) q = q.eq("channel", filterChannel);
    if (filterEvent) q = q.eq("event", filterEvent);
    if (filterActor) q = q.ilike("actor", `%${filterActor}%`);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as Row[]) || []);
  }

  useEffect(() => { load(); }, [filterChannel, filterEvent, filterActor, rangeHours]); // eslint-disable-line

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.event] = (c[r.event] || 0) + 1;
    return c;
  }, [rows]);

  function exportCsv() {
    const headers = ["created_at", "channel", "event", "business", "actor", "reason", "ip_address", "user_agent"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const cells = [
        r.created_at,
        r.channel,
        r.event,
        (r.prospect?.business_name || "").replace(/,/g, " "),
        r.actor || "",
        (r.reason || "").replace(/[\r\n,]/g, " "),
        r.ip_address || "",
        (r.user_agent || "").replace(/[\r\n,]/g, " "),
      ];
      lines.push(cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `outreach-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="text-cyan-400" size={18} />
          <div>
            <h1 className="text-lg font-black uppercase tracking-widest text-foreground">Outreach Audit Log</h1>
            <p className="text-xs text-muted-foreground">Every scrape, enrich, send, open, click, bounce, and unsubscribe — timestamped and attributable.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-background/40 inline-flex items-center gap-1">
            <RefreshCw size={11} /> Refresh
          </button>
          <button onClick={exportCsv} className="text-xs px-3 py-1.5 rounded bg-cyan-500 text-slate-900 font-bold hover:bg-cyan-400 inline-flex items-center gap-1">
            <Download size={11} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap gap-2 items-center">
        <Filter size={13} className="text-muted-foreground" />
        <select value={String(rangeHours)} onChange={e => setRangeHours(parseInt(e.target.value))} className="bg-background border border-border rounded px-2 py-1.5 text-xs">
          {RANGE_OPTIONS.map(o => <option key={o.hours} value={o.hours}>{o.label}</option>)}
        </select>
        <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className="bg-background border border-border rounded px-2 py-1.5 text-xs">
          <option value="">All channels</option>
          {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="bg-background border border-border rounded px-2 py-1.5 text-xs">
          <option value="">All events</option>
          {EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <input
          value={filterActor}
          onChange={e => setFilterActor(e.target.value)}
          placeholder="Actor (admin / system / recipient)"
          className="bg-background border border-border rounded px-2 py-1.5 text-xs flex-1 min-w-[180px]"
        />
        <span className="text-[11px] text-muted-foreground ml-auto">Showing {rows.length} rows</span>
      </div>

      {/* Stat tiles per event */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {EVENTS.map(ev => (
          <div key={ev} className="bg-card border border-border rounded p-2">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{ev.replace(/_/g, " ")}</p>
            <p className="text-lg font-black text-foreground">{counts[ev] || 0}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        {loading ? (
          <div className="p-6 text-center text-xs text-muted-foreground inline-flex items-center gap-2 justify-center w-full">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No audit events match these filters.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-background/40 text-muted-foreground">
              <tr>
                <th className="text-left p-2.5">When</th>
                <th className="text-left p-2.5">Channel</th>
                <th className="text-left p-2.5">Event</th>
                <th className="text-left p-2.5">Prospect</th>
                <th className="text-left p-2.5">Actor</th>
                <th className="text-left p-2.5">Reason / IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-background/30">
                  <td className="p-2.5 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.channel === "email" ? "bg-cyan-500/20 text-cyan-300" : "bg-emerald-500/20 text-emerald-300"}`}>{r.channel}</span></td>
                  <td className="p-2.5"><EventBadge event={r.event} /></td>
                  <td className="p-2.5">
                    {r.prospect ? (
                      <div>
                        <div className="text-foreground font-semibold">{r.prospect.business_name}</div>
                        <div className="text-[10px] text-muted-foreground">{r.prospect.trade} · {r.prospect.city}</div>
                      </div>
                    ) : <span className="text-muted-foreground italic">—</span>}
                  </td>
                  <td className="p-2.5 text-muted-foreground">{r.actor || "system"}</td>
                  <td className="p-2.5 text-muted-foreground">
                    {r.reason && <div className="max-w-[260px] truncate" title={r.reason}>{r.reason}</div>}
                    {r.ip_address && <div className="text-[10px] text-slate-400">IP: {r.ip_address}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EventBadge({ event }: { event: string }) {
  const map: Record<string, string> = {
    sent: "bg-emerald-500/20 text-emerald-300",
    opened: "bg-cyan-500/20 text-cyan-300",
    clicked: "bg-cyan-500/30 text-cyan-200",
    replied: "bg-violet-500/20 text-violet-300",
    unsubscribed: "bg-amber-500/20 text-amber-300",
    suppressed: "bg-slate-500/20 text-slate-300",
    consent_granted: "bg-emerald-500/30 text-emerald-200",
    consent_revoked: "bg-amber-500/30 text-amber-200",
    quiet_hours_blocked: "bg-rose-500/20 text-rose-300",
    daily_cap_blocked: "bg-rose-500/20 text-rose-300",
    bounce: "bg-red-500/20 text-red-300",
  };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${map[event] || "bg-slate-500/20 text-slate-300"}`}>{event.replace(/_/g, " ")}</span>;
}
