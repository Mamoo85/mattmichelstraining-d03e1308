import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Printer, Inbox, Upload, Play, Pause, RefreshCw, Radar, Database } from "lucide-react";
import TargetDiscoveryPanel from "./TargetDiscoveryPanel";
import SourceCatalogPanel from "./SourceCatalogPanel";

type Channel = "email" | "fax" | "postcard";

interface Campaign {
  id: string;
  name: string;
  channel: Channel;
  product: string;
  verticals: string[];
  states: string[];
  template_subject: string | null;
  template_body: string;
  cta_url: string | null;
  daily_send_cap: number;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  total_sent: number;
  total_replied: number;
  last_run_at: string | null;
  created_at: string;
}

interface Send {
  id: string;
  campaign_id: string;
  channel: string;
  status: string;
  recipient_email: string | null;
  recipient_fax: string | null;
  recipient_address: string | null;
  error_message: string | null;
  sent_at: string | null;
  cost_cents: number | null;
}

const CHANNEL_META: Record<Channel, { icon: any; fn: string; cost: string; color: string }> = {
  email:    { icon: Mail,    fn: "outreach-email-blast",    cost: "$0.0004", color: "text-cyan-400" },
  fax:      { icon: Printer, fn: "outreach-fax-blast",      cost: "$0.07",   color: "text-amber-400" },
  postcard: { icon: Inbox,   fn: "outreach-postcard-blast", cost: "$0.85",   color: "text-emerald-400" },
};

const VERTICAL_OPTIONS = [
  "roofing", "plumbing", "hvac", "electrical", "landscaping", "arborist",
  "concrete", "painting", "flooring", "siding", "general_contractor", "garage_door",
];
const STATE_OPTIONS = ["MI", "OH", "IN", "IL", "WI", "TX", "FL"];

export default function Wave5OutreachConsole() {
  const [tab, setTab] = useState<"campaigns" | "discover" | "sources" | "targets" | "sends">("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sends, setSends] = useState<Send[]>([]);
  const [targetCount, setTargetCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const [c, s, t] = await Promise.all([
      supabase.from("outreach_campaigns" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("outreach_sends" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("outreach_targets" as any).select("id", { count: "exact", head: true }),
    ]);
    setCampaigns((c.data as any) || []);
    setSends((s.data as any) || []);
    setTargetCount(t.count ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function fireBlast(c: Campaign) {
    setBusy(c.id);
    try {
      const fn = CHANNEL_META[c.channel].fn;
      const { data, error } = await supabase.functions.invoke(fn, { body: { campaign_id: c.id } });
      if (error) throw error;
      const r = (data as any)?.results?.[0];
      toast.success(`${c.name}: sent ${r?.sent ?? 0}, failed ${r?.failed ?? 0}`);
      await load();
    } catch (e) {
      toast.error(`Blast failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(c: Campaign, status: Campaign["status"]) {
    const { error } = await supabase.from("outreach_campaigns" as any).update({ status }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success(`${c.name} → ${status}`); load(); }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">📡 Wave 5 Outreach Console</h1>
          <p className="text-sm text-white/60 mt-1">
            Mass email · Sinch fax · Lob postcards. Founder + DNC auto-skip. {targetCount.toLocaleString()} targets in pool.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded border border-white/10 text-white/70 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button onClick={() => setShowNew(true)} className="text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold px-3 py-1.5 rounded">
            + New campaign
          </button>
        </div>
      </header>

      <div className="flex gap-2 border-b border-white/10 mb-4 flex-wrap">
        {(["campaigns", "discover", "sources", "targets", "sends"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === t ? "border-cyan-400 text-cyan-400" : "border-transparent text-white/50 hover:text-white/80"
            }`}
          >
            {t === "discover" && <Radar className="w-3.5 h-3.5" />}
            {t === "sources" && <Database className="w-3.5 h-3.5" />}
            {t === "campaigns" ? "Campaigns"
              : t === "discover" ? "Discover"
              : t === "sources" ? "Sources"
              : t === "targets" ? "CSV / Pool"
              : "Recent sends"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-white/40 flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : tab === "campaigns" ? (
        <CampaignsTab campaigns={campaigns} busy={busy} onFire={fireBlast} onStatus={setStatus} />
      ) : tab === "discover" ? (
        <TargetDiscoveryPanel />
      ) : tab === "sources" ? (
        <SourceCatalogPanel />
      ) : tab === "targets" ? (
        <TargetsTab count={targetCount} onChange={load} />
      ) : (
        <SendsTab sends={sends} campaigns={campaigns} />
      )}

      {showNew && <NewCampaignDialog onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

// ---------- Campaigns tab ----------
function CampaignsTab({
  campaigns, busy, onFire, onStatus,
}: {
  campaigns: Campaign[];
  busy: string | null;
  onFire: (c: Campaign) => void;
  onStatus: (c: Campaign, s: Campaign["status"]) => void;
}) {
  if (campaigns.length === 0) {
    return <div className="text-white/40 text-sm border border-dashed border-white/10 rounded-lg p-8 text-center">
      No campaigns yet. Click <span className="text-cyan-400">+ New campaign</span> to create one.
    </div>;
  }
  return (
    <div className="grid gap-3">
      {campaigns.map((c) => {
        const Meta = CHANNEL_META[c.channel];
        const Icon = Meta?.icon;
        return (
          <div key={c.id} className="border border-white/10 bg-slate-900/50 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {Icon && <Icon className={`w-4 h-4 ${Meta.color}`} />}
                  <h3 className="font-bold text-white">{c.name}</h3>
                  <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                    c.status === "active" ? "bg-emerald-500/20 text-emerald-400"
                    : c.status === "paused" ? "bg-amber-500/20 text-amber-400"
                    : "bg-white/10 text-white/50"
                  }`}>{c.status}</span>
                </div>
                <div className="text-xs text-white/50 flex flex-wrap gap-x-3 gap-y-1">
                  <span>📦 {c.product}</span>
                  <span>🏷️ {c.verticals.join(", ") || "any"}</span>
                  <span>📍 {c.states.join(", ")}</span>
                  <span>🎯 cap {c.daily_send_cap}/day</span>
                  <span>💸 {Meta?.cost}/send</span>
                </div>
                <div className="text-xs text-white/40 mt-2">
                  Sent: <span className="text-white/70">{c.total_sent}</span> ·
                  Replied: <span className="text-white/70">{c.total_replied}</span> ·
                  Last run: <span className="text-white/70">{c.last_run_at ? new Date(c.last_run_at).toLocaleString() : "never"}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => onFire(c)}
                  disabled={busy === c.id || c.status !== "active"}
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-slate-900 font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1"
                >
                  {busy === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Fire blast
                </button>
                {c.status === "active" ? (
                  <button onClick={() => onStatus(c, "paused")} className="text-xs bg-white/5 hover:bg-white/10 text-white/70 px-3 py-1.5 rounded flex items-center gap-1">
                    <Pause className="w-3 h-3" /> Pause
                  </button>
                ) : (
                  <button onClick={() => onStatus(c, "active")} className="text-xs bg-white/5 hover:bg-white/10 text-emerald-400 px-3 py-1.5 rounded">
                    Activate
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Targets tab (CSV upload) ----------
function TargetsTab({ count, onChange }: { count: number; onChange: () => void }) {
  const [csv, setCsv] = useState("");
  const [vertical, setVertical] = useState("roofing");
  const [state, setState] = useState("MI");
  const [busy, setBusy] = useState(false);

  async function ingest() {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast.error("Paste at least one row"); return; }

    // Detect header
    const first = lines[0].toLowerCase();
    const hasHeader = first.includes("email") || first.includes("business") || first.includes("name");
    const headers = hasHeader
      ? lines[0].split(",").map((h) => h.trim().toLowerCase())
      : ["business_name", "owner_first_name", "email", "phone", "fax", "address_line1", "city", "zip"];
    const dataRows = hasHeader ? lines.slice(1) : lines;

    const rows = dataRows.map((row) => {
      const cells = row.split(",").map((c) => c.trim());
      const obj: any = { vertical, state, source: "manual_csv" };
      headers.forEach((h, i) => {
        if (cells[i]) obj[h] = cells[i];
      });
      return obj;
    }).filter((r) => r.email || r.fax || r.address_line1);

    if (rows.length === 0) { toast.error("No rows had an email, fax, or address."); return; }

    setBusy(true);
    try {
      // Upsert in chunks of 100
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error, count: c } = await supabase
          .from("outreach_targets" as any)
          .upsert(chunk, { onConflict: "email", ignoreDuplicates: true, count: "exact" });
        if (error) throw error;
        inserted += c ?? chunk.length;
      }
      toast.success(`Ingested ${inserted} of ${rows.length} rows`);
      setCsv("");
      onChange();
    } catch (e) {
      toast.error(`Ingest failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="border border-white/10 bg-slate-900/50 rounded-lg p-4">
        <div className="text-sm text-white/70 mb-3">
          <strong className="text-white">{count.toLocaleString()}</strong> targets in pool.
          Founders, DNC, and already-contacted are auto-skipped at send time.
        </div>
      </div>

      <div className="border border-white/10 bg-slate-900/50 rounded-lg p-4">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Upload className="w-4 h-4 text-cyan-400" /> Paste CSV to ingest
        </h3>
        <p className="text-xs text-white/50 mb-3">
          Headers: <code className="text-cyan-400">business_name, owner_first_name, owner_last_name, email, phone, fax, address_line1, city, zip</code>.
          Vertical + state set below apply to all rows.
        </p>
        <div className="flex gap-2 mb-2">
          <select value={vertical} onChange={(e) => setVertical(e.target.value)}
            className="bg-slate-950 border border-white/10 text-white text-sm px-2 py-1.5 rounded">
            {VERTICAL_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={state} onChange={(e) => setState(e.target.value)}
            className="bg-slate-950 border border-white/10 text-white text-sm px-2 py-1.5 rounded">
            {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={10}
          placeholder="business_name,owner_first_name,email,phone,fax,address_line1,city,zip&#10;Acme Roofing,John,john@acme.com,5551234567,,123 Main St,Detroit,48201"
          className="w-full bg-slate-950 border border-white/10 text-white text-xs font-mono px-3 py-2 rounded resize-y"
        />
        <button
          onClick={ingest}
          disabled={busy || !csv.trim()}
          className="mt-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-slate-900 font-bold text-sm px-4 py-2 rounded flex items-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Ingest into pool
        </button>
      </div>
    </div>
  );
}

// ---------- Sends tab ----------
function SendsTab({ sends, campaigns }: { sends: Send[]; campaigns: Campaign[] }) {
  const cMap = useMemo(() => new Map(campaigns.map((c) => [c.id, c.name])), [campaigns]);
  if (sends.length === 0) {
    return <div className="text-white/40 text-sm border border-dashed border-white/10 rounded-lg p-8 text-center">No sends yet.</div>;
  }
  return (
    <div className="border border-white/10 bg-slate-900/50 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-white/5">
          <tr className="text-left text-white/50">
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Campaign</th>
            <th className="px-3 py-2">Channel</th>
            <th className="px-3 py-2">Recipient</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Cost</th>
          </tr>
        </thead>
        <tbody>
          {sends.map((s) => (
            <tr key={s.id} className="border-t border-white/5 text-white/80">
              <td className="px-3 py-2 text-white/50">{s.sent_at ? new Date(s.sent_at).toLocaleString() : "—"}</td>
              <td className="px-3 py-2">{cMap.get(s.campaign_id) || "—"}</td>
              <td className="px-3 py-2">{s.channel}</td>
              <td className="px-3 py-2 truncate max-w-[260px]">
                {s.recipient_email || s.recipient_fax || s.recipient_address || "—"}
              </td>
              <td className="px-3 py-2">
                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                  s.status === "sent" ? "bg-emerald-500/20 text-emerald-400"
                  : s.status === "failed" ? "bg-rose-500/20 text-rose-400"
                  : "bg-white/10 text-white/50"
                }`}>{s.status}</span>
                {s.error_message && <div className="text-[10px] text-rose-400/70 mt-0.5 truncate max-w-[200px]">{s.error_message}</div>}
              </td>
              <td className="px-3 py-2 text-white/50">{s.cost_cents ? `$${(s.cost_cents / 100).toFixed(2)}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- New campaign dialog ----------
function NewCampaignDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [product, setProduct] = useState("roofing_radar");
  const [vertical, setVertical] = useState("roofing");
  const [state, setState] = useState("MI");
  const [subject, setSubject] = useState("Quick question about {{business_name}}");
  const [body, setBody] = useState(
    "Hi {{first_name}},\n\nI run Detroit Web Agency and we just launched a free 7-day trial of {{vertical}} Radar — a tool that surfaces hot {{vertical}} leads in {{city}} every morning before your competitors see them.\n\nNo credit card. Reply STOP to opt out.\n\n— Matt Michels\n(313) 992-1219",
  );
  const [cap, setCap] = useState(50);
  const [cta, setCta] = useState("https://detroitwebagent.com/trial");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || !body.trim()) { toast.error("Name and body required"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("outreach_campaigns" as any).insert({
        name, channel, product,
        verticals: [vertical], states: [state],
        template_subject: channel === "email" ? subject : null,
        template_body: body, cta_url: cta,
        daily_send_cap: cap, status: "draft",
      });
      if (error) throw error;
      toast.success(`Campaign created (draft)`);
      onCreated();
    } catch (e) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">New outreach campaign</h2>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name (e.g. Roofers MI - Email D0)"
            className="w-full bg-slate-950 border border-white/10 text-white text-sm px-3 py-2 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="bg-slate-950 border border-white/10 text-white text-sm px-2 py-2 rounded">
              <option value="email">📧 Email</option>
              <option value="fax">📠 Fax</option>
              <option value="postcard">✉️ Postcard</option>
            </select>
            <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="product slug"
              className="bg-slate-950 border border-white/10 text-white text-sm px-2 py-2 rounded" />
            <select value={vertical} onChange={(e) => setVertical(e.target.value)} className="bg-slate-950 border border-white/10 text-white text-sm px-2 py-2 rounded">
              {VERTICAL_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={state} onChange={(e) => setState(e.target.value)} className="bg-slate-950 border border-white/10 text-white text-sm px-2 py-2 rounded">
              {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {channel === "email" && (
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
              className="w-full bg-slate-950 border border-white/10 text-white text-sm px-3 py-2 rounded" />
          )}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
            placeholder="Body — supports {{first_name}}, {{business_name}}, {{vertical}}, {{city}}, {{cta_url}}"
            className="w-full bg-slate-950 border border-white/10 text-white text-xs font-mono px-3 py-2 rounded resize-y" />
          <div className="grid grid-cols-2 gap-2">
            <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="CTA URL"
              className="bg-slate-950 border border-white/10 text-white text-sm px-3 py-2 rounded" />
            <input type="number" value={cap} onChange={(e) => setCap(parseInt(e.target.value) || 50)} placeholder="Daily cap"
              className="bg-slate-950 border border-white/10 text-white text-sm px-3 py-2 rounded" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-sm bg-white/5 hover:bg-white/10 text-white/70 px-4 py-2 rounded">Cancel</button>
          <button onClick={create} disabled={busy} className="text-sm bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold px-4 py-2 rounded flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create draft
          </button>
        </div>
      </div>
    </div>
  );
}
