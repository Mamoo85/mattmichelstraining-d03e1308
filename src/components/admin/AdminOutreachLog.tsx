import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, MessageSquare, Send, ShieldOff, Filter, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Channel = "all" | "sms" | "email" | "postcard" | "dm";
type StatusFilter = "all" | "sent" | "failed" | "blocked" | "delivered";
type RangeKey = "24h" | "7d" | "30d" | "90d";

interface CommsRow {
  id: string;
  channel: string;
  product: string | null;
  recipient: string;
  body_preview: string | null;
  body_hash: string | null;
  status: string;
  error_message: string | null;
  twilio_status: string | null;
  created_at: string;
}

interface PostcardRow {
  id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  county: string | null;
  postcard_sent_at: string | null;
  converted_at: string | null;
}

interface PostcardEvent {
  id: string;
  prospect_id: string | null;
  event: string;
  created_at: string;
}

const RANGE_HOURS: Record<RangeKey, number> = { "24h": 24, "7d": 168, "30d": 720, "90d": 2160 };

export default function AdminOutreachLog() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<RangeKey>("7d");
  const [channel, setChannel] = useState<Channel>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const [comms, setComms] = useState<CommsRow[]>([]);
  const [postcards, setPostcards] = useState<PostcardRow[]>([]);
  const [postcardEvents, setPostcardEvents] = useState<PostcardEvent[]>([]);
  const [smsOptOuts, setSmsOptOuts] = useState<Set<string>>(new Set());
  const [emailSuppressed, setEmailSuppressed] = useState<Set<string>>(new Set());
  const [blocklist, setBlocklist] = useState<Set<string>>(new Set());

  const since = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - RANGE_HOURS[range]);
    return d.toISOString();
  }, [range]);

  async function fetchAll() {
    setRefreshing(true);
    try {
      const [c, p, pe, opts, supp, bl] = await Promise.all([
        (supabase as any)
          .from("system_comms_log")
          .select("id,channel,product,recipient,body_preview,body_hash,status,error_message,twilio_status,created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(2000),
        (supabase as any)
          .from("postcard_prospects")
          .select("id,business_name,email,phone,county,postcard_sent_at,converted_at")
          .gte("postcard_sent_at", since)
          .not("postcard_sent_at", "is", null)
          .order("postcard_sent_at", { ascending: false })
          .limit(1000),
        (supabase as any)
          .from("postcard_conversions")
          .select("id,prospect_id,event,created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1000),
        (supabase as any).from("sms_opt_outs").select("phone").limit(5000),
        (supabase as any).from("suppressed_emails").select("email").limit(5000),
        (supabase as any).from("outreach_blocklist").select("recipient").limit(5000),
      ]);
      setComms((c.data as CommsRow[]) || []);
      setPostcards((p.data as PostcardRow[]) || []);
      setPostcardEvents((pe.data as PostcardEvent[]) || []);
      setSmsOptOuts(new Set(((opts.data as { phone: string }[]) || []).map(r => r.phone)));
      setEmailSuppressed(new Set(((supp.data as { email: string }[]) || []).map(r => (r.email || "").toLowerCase())));
      setBlocklist(new Set(((bl.data as { recipient: string }[]) || []).map(r => (r.recipient || "").toLowerCase())));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load outreach log");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range]);

  // ── Build unified rows ──
  type UnifiedRow = {
    id: string;
    created_at: string;
    channel: "sms" | "email" | "postcard" | "dm" | "other";
    product: string | null;
    recipient: string;
    preview: string | null;
    status: "sent" | "delivered" | "failed" | "blocked" | "scanned" | "queued";
    consent: "ok" | "opted_out" | "suppressed" | "blocklisted";
    is_duplicate: boolean;
    error: string | null;
  };

  const unified: UnifiedRow[] = useMemo(() => {
    const out: UnifiedRow[] = [];

    // Dedup detection: same recipient + body_hash within 7 days (uses what's loaded)
    const seenHash = new Map<string, number>();
    for (const r of comms) {
      const k = r.body_hash ? `${r.recipient}|${r.body_hash}` : "";
      if (!k) continue;
      seenHash.set(k, (seenHash.get(k) || 0) + 1);
    }

    for (const r of comms) {
      const ch: UnifiedRow["channel"] =
        r.channel === "sms" ? "sms" :
        r.channel === "email" ? "email" :
        r.channel === "dm" || r.channel === "linkedin" ? "dm" : "other";
      const isOptOut = ch === "sms" && smsOptOuts.has(r.recipient);
      const isSuppressed = ch === "email" && emailSuppressed.has(r.recipient.toLowerCase());
      const isBlocked = blocklist.has((r.recipient || "").toLowerCase());
      const consent: UnifiedRow["consent"] =
        isBlocked ? "blocklisted" :
        isOptOut ? "opted_out" :
        isSuppressed ? "suppressed" : "ok";

      let st: UnifiedRow["status"] = "sent";
      if (r.status === "failed" || r.status === "dlq" || r.status === "bounced") st = "failed";
      else if (r.status === "suppressed" || r.status === "blocked") st = "blocked";
      else if (r.twilio_status === "delivered" || r.status === "delivered") st = "delivered";
      else if (r.status === "pending" || r.status === "queued") st = "queued";

      const k = r.body_hash ? `${r.recipient}|${r.body_hash}` : "";
      out.push({
        id: r.id,
        created_at: r.created_at,
        channel: ch,
        product: r.product,
        recipient: r.recipient,
        preview: r.body_preview,
        status: st,
        consent,
        is_duplicate: !!k && (seenHash.get(k) || 0) > 1,
        error: r.error_message,
      });
    }

    // Postcards — one row per send, plus inbound scan/conversion events
    const prospectMap = new Map(postcards.map(p => [p.id, p]));
    for (const p of postcards) {
      if (!p.postcard_sent_at) continue;
      out.push({
        id: `pc-${p.id}`,
        created_at: p.postcard_sent_at,
        channel: "postcard",
        product: "postcard_campaign",
        recipient: p.business_name + (p.county ? ` (${p.county})` : ""),
        preview: "Postcard mailed via Lob",
        status: p.converted_at ? "delivered" : "sent",
        consent: "ok",
        is_duplicate: false,
        error: null,
      });
    }
    for (const ev of postcardEvents) {
      const p = ev.prospect_id ? prospectMap.get(ev.prospect_id) : undefined;
      out.push({
        id: `pce-${ev.id}`,
        created_at: ev.created_at,
        channel: "postcard",
        product: `postcard_${ev.event}`,
        recipient: p?.business_name || "(unknown prospect)",
        preview: `QR/landing event: ${ev.event}`,
        status: ev.event === "purchased" ? "delivered" : "scanned",
        consent: "ok",
        is_duplicate: false,
        error: null,
      });
    }

    out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return out;
  }, [comms, postcards, postcardEvents, smsOptOuts, emailSuppressed, blocklist]);

  const filtered = useMemo(() => {
    return unified.filter(r => {
      if (channel !== "all" && r.channel !== channel) return false;
      if (status !== "all") {
        if (status === "blocked" && r.consent === "ok" && r.status !== "blocked") return false;
        if (status === "sent" && !(r.status === "sent" || r.status === "delivered" || r.status === "queued")) return false;
        if (status === "failed" && r.status !== "failed") return false;
        if (status === "delivered" && r.status !== "delivered") return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!r.recipient.toLowerCase().includes(q) &&
            !(r.product || "").toLowerCase().includes(q) &&
            !(r.preview || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [unified, channel, status, search]);

  const stats = useMemo(() => {
    const s = {
      total: unified.length,
      sms: 0, email: 0, postcard: 0, dm: 0,
      sent: 0, delivered: 0, failed: 0, blocked: 0,
      duplicates: 0, consent_blocked: 0,
    };
    for (const r of unified) {
      if (r.channel === "sms") s.sms++;
      else if (r.channel === "email") s.email++;
      else if (r.channel === "postcard") s.postcard++;
      else if (r.channel === "dm") s.dm++;
      if (r.status === "sent" || r.status === "queued") s.sent++;
      else if (r.status === "delivered") s.delivered++;
      else if (r.status === "failed") s.failed++;
      else if (r.status === "blocked") s.blocked++;
      if (r.is_duplicate) s.duplicates++;
      if (r.consent !== "ok") s.consent_blocked++;
    }
    return s;
  }, [unified]);

  function exportCSV() {
    if (filtered.length === 0) { toast.error("No rows to export"); return; }
    const headers = ["timestamp", "channel", "product", "recipient", "status", "consent", "is_duplicate", "preview", "error"];
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push([r.created_at, r.channel, r.product, r.recipient, r.status, r.consent, r.is_duplicate, r.preview, r.error].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach-log-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">📡 Outreach Log</h1>
          <p className="text-xs text-white/50">Unified attempts across SMS, email, postcards, and DMs — with consent + dedup tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8 border-white/20 text-white hover:bg-white/10"
            onClick={fetchAll} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </Button>
          <Button size="sm" className="text-xs h-8 bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/25"
            onClick={exportCSV}>
            <Download className="w-3 h-3" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <Stat label="Total" value={stats.total} accent="#00d4ff" />
        <Stat label="SMS" value={stats.sms} icon={<MessageSquare className="w-3 h-3" />} accent="#a78bfa" />
        <Stat label="Email" value={stats.email} icon={<Mail className="w-3 h-3" />} accent="#60a5fa" />
        <Stat label="Postcard" value={stats.postcard} icon={<Send className="w-3 h-3" />} accent="#fbbf24" />
        <Stat label="Sent/Queued" value={stats.sent} accent="#10b981" />
        <Stat label="Delivered" value={stats.delivered} accent="#22d3ee" />
        <Stat label="Failed" value={stats.failed} accent="#ef4444" />
        <Stat label="Consent blocks" value={stats.consent_blocked} icon={<ShieldOff className="w-3 h-3" />} accent="#f97316" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded border border-white/10 bg-white/5">
        <Filter className="w-4 h-4 text-white/40" />
        <Segmented value={range} onChange={v => setRange(v as RangeKey)}
          options={[["24h", "24h"], ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"]]} />
        <span className="text-white/20">|</span>
        <Segmented value={channel} onChange={v => setChannel(v as Channel)}
          options={[["all", "All"], ["sms", "SMS"], ["email", "Email"], ["postcard", "Postcard"], ["dm", "DM"]]} />
        <span className="text-white/20">|</span>
        <Segmented value={status} onChange={v => setStatus(v as StatusFilter)}
          options={[["all", "Any"], ["sent", "Sent"], ["delivered", "Delivered"], ["failed", "Failed"], ["blocked", "Blocked"]]} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipient, product, body…"
          className="ml-auto bg-black/30 border border-white/15 rounded px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#00d4ff]/50 w-64"
        />
        <span className="text-[11px] text-white/40">{filtered.length} of {unified.length}</span>
      </div>

      {/* Duplicates banner */}
      {stats.duplicates > 0 && (
        <div className="text-xs px-3 py-2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">
          ⚠️ {stats.duplicates} duplicate sends detected (same recipient + identical message body within window)
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded border border-white/10">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-white/60 uppercase tracking-wide text-[10px]">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Channel</th>
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-left px-3 py-2">Recipient</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Consent</th>
              <th className="text-left px-3 py-2">Body / Note</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 500).map(r => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-2 text-white/60 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/80">{r.channel}</span>
                </td>
                <td className="px-3 py-2 text-white/60">{r.product || "—"}</td>
                <td className="px-3 py-2 text-white">{r.recipient}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2">
                  <ConsentBadge consent={r.consent} duplicate={r.is_duplicate} />
                </td>
                <td className="px-3 py-2 text-white/50 max-w-md truncate" title={r.preview || ""}>
                  {r.error ? <span className="text-red-400">{r.error}</span> : (r.preview || "—")}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-white/40">No outreach matches the current filters.</td></tr>
            )}
          </tbody>
        </table>
        {filtered.length > 500 && (
          <div className="px-3 py-2 text-[11px] text-white/40 bg-white/5 border-t border-white/10">
            Showing first 500 rows. Export CSV for the full set ({filtered.length} matching).
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: number; icon?: React.ReactNode; accent: string }) {
  return (
    <div className="rounded border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase text-white/50">{icon}{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: accent }}>{value.toLocaleString()}</div>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="inline-flex items-center rounded border border-white/15 bg-black/30 p-0.5">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
            value === v ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "text-white/60 hover:text-white"
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    queued: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    delivered: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    failed: "bg-red-500/15 text-red-300 border-red-500/30",
    blocked: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    scanned: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${map[status] || "bg-white/10 text-white/70 border-white/20"}`}>{status}</span>;
}

function ConsentBadge({ consent, duplicate }: { consent: string; duplicate: boolean }) {
  if (consent === "ok" && !duplicate) return <span className="text-emerald-400 text-[11px]">✓ ok</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {consent !== "ok" && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/15 text-orange-300 border border-orange-500/30">{consent}</span>
      )}
      {duplicate && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">duplicate</span>
      )}
    </div>
  );
}
