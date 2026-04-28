import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Sparkles, RefreshCw, ExternalLink, Trash2, Send, Activity, MessageSquare, ShieldCheck, Stethoscope } from "lucide-react";
import OutreachProvenancePanel from "./OutreachProvenancePanel";
import OutreachSuppressionManager from "./OutreachSuppressionManager";
import OutreachAuditDrawer from "./OutreachAuditDrawer";
import OutreachConsentDialog from "./OutreachConsentDialog";
import OutreachInfoBox from "./OutreachInfoBox";
import OutreachGlobalSettings from "./OutreachGlobalSettings";
import OnePressLauncher from "./OnePressLauncher";
import LeadDiagnosticsDrawer from "./LeadDiagnosticsDrawer";
import { Link } from "react-router-dom";


const DAILY_EMAIL_CAP = 100;
const DAILY_SMS_CAP = 50;

interface Prospect {
  id: string;
  business_name: string;
  owner_name: string | null;
  trade: string;
  city: string | null;
  state: string;
  email: string | null;
  email_verified: boolean;
  phone: string | null;
  website: string | null;
  source: string | null;
  enriched_at: string | null;
  last_emailed_at: string | null;
  email_send_count: number;
  reply_status: string | null;
  consent_for_sms: boolean;
  consent_for_email: boolean;
  unsubscribed_at: string | null;
  quality_score: number | null;
  is_demo: boolean;
  territory_priority: number;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  project_type: string | null;
  is_demo_record: boolean;
  contractor_lead_sites?: { trade: string; city: string };
}

const TRADES = ["HVAC", "Plumbing", "Electrical", "Roofing", "Boiler", "Gutters", "Siding", "Healthcare/RN", "Healthcare/CNA", "Healthcare/LPN"];

interface GlobalSettings {
  cold_email_enabled: boolean;
  cold_sms_enabled: boolean;
  min_quality_score_to_send: number;
  hide_demo_leads_below_score: number;
}

export default function ContractorOutreachPanel() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [unclaimedLeads, setUnclaimedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrapeTrade, setScrapeTrade] = useState("HVAC");
  const [scrapeCity, setScrapeCity] = useState("Warren");
  const [scraping, setScraping] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [blastingLeadId, setBlastingLeadId] = useState<string | null>(null);
  const [filterTrade, setFilterTrade] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterTerritory, setFilterTerritory] = useState<string>("");
  const [filterMinQuality, setFilterMinQuality] = useState<number>(0);
  const [hideDemo, setHideDemo] = useState<boolean>(true);
  const [emailsToday, setEmailsToday] = useState(0);
  const [smsToday, setSmsToday] = useState(0);
  const [auditFor, setAuditFor] = useState<{ id: string; name: string } | null>(null);
  const [consentFor, setConsentFor] = useState<{ id: string; name: string; channel: "sms" | "email" | "both" } | null>(null);
  const [diagnosticsFor, setDiagnosticsFor] = useState<string | null>(null);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [pRes, lRes, eRes, sRes] = await Promise.all([
      supabase.from("contractor_outreach_prospects" as never)
        .select("*")
        .is("unsubscribed_at", null)
        .order("scraped_at", { ascending: false })
        .limit(200),
      supabase.from("contractor_leads" as never)
        .select("id, name, phone, project_type, is_demo_record, contractor_lead_sites(trade, city)")
        .is("client_id", null)
        .eq("is_demo_record", false)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase as any).from("contractor_outreach_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("channel", "email").eq("event", "sent").gte("created_at", since),
      (supabase as any).from("contractor_outreach_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("channel", "sms").eq("event", "sent").gte("created_at", since),
    ]);
    setProspects(((pRes.data as any[]) || []) as Prospect[]);
    setUnclaimedLeads(((lRes.data as any[]) || []) as Lead[]);
    setEmailsToday((eRes as any).count || 0);
    setSmsToday((sRes as any).count || 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runScrape() {
    if (!scrapeTrade || !scrapeCity.trim()) return;
    setScraping(true);
    const { data, error } = await supabase.functions.invoke("contractor-outreach-scrape", {
      body: { trade: scrapeTrade, city: scrapeCity.trim(), state: "MI", limit: 20 },
    });
    setScraping(false);
    if (error) { toast.error(error.message); return; }
    const d = data as any;
    if (!d?.ok) { toast.error(d?.error || "Scrape failed"); return; }
    toast.success(`Found ${d.scanned} · added ${d.inserted} new ${scrapeTrade} contractors in ${scrapeCity}`);
    load();
  }

  async function runStatewideSweep(tier: "primary" | "secondary" | "tertiary") {
    if (sweeping) return;
    setSweeping(true);
    const toastId = toast.loading(`🗺️ Statewide ${tier} sweep running…`);
    try {
      const { data, error } = await supabase.functions.invoke("contractor-outreach-statewide-sweep", {
        body: { tiers: [tier], limit_per_query: 20, max_seconds: 90 },
      });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (!d?.ok) throw new Error(d?.error || "Sweep failed");
      toast.success(
        `Sweep ${d.completed_all ? "complete" : `partial (resume @ ${d.next_start_index})`} — scanned ${d.scanned}, added ${d.inserted}, skipped ${d.skipped_duplicates}`,
        { id: toastId, duration: 7000 },
      );
      load();
    } catch (e: any) {
      toast.error(e?.message || "Sweep failed", { id: toastId });
    } finally {
      setSweeping(false);
    }
  }

  async function enrich(id: string) {
    setEnrichingId(id);
    const { data, error } = await supabase.functions.invoke("contractor-outreach-enrich", {
      body: { prospect_id: id },
    });
    setEnrichingId(null);
    if (error) { toast.error(error.message); return; }
    const d = data as any;
    if (!d?.ok) { toast.error(d?.error || "Enrich failed"); return; }
    const email = d?.prospect?.email;
    toast.success(email ? `Found: ${email}` : "No email found");
    load();
  }

  async function blastLead(leadId: string) {
    const lastPrice = localStorage.getItem("dwa_last_blast_price") || "59";
    const lastCount = localStorage.getItem("dwa_last_blast_count") || "10";
    const priceStr = window.prompt("Price per claim (USD)?", lastPrice);
    if (!priceStr) return;
    const price = parseInt(priceStr, 10);
    if (!Number.isFinite(price) || price < 10 || price > 500) {
      toast.error("Price must be 10–500"); return;
    }
    const maxStr = window.prompt("How many contractors to email?", lastCount);
    if (!maxStr) return;
    const max = parseInt(maxStr, 10);
    if (!Number.isFinite(max) || max < 1 || max > 50) {
      toast.error("Count must be 1–50"); return;
    }
    localStorage.setItem("dwa_last_blast_price", String(price));
    localStorage.setItem("dwa_last_blast_count", String(max));

    setBlastingLeadId(leadId);
    const toastId = toast.loading("🔍 Auto-blast: scrape → enrich → email…", {
      description: "Step 1 of 3 · finding contractors on Google Maps",
    });

    // Show simulated progress while the server orchestrates
    const progressTimer = setTimeout(() => {
      toast.loading("✨ Enriching contractor emails…", {
        id: toastId,
        description: "Step 2 of 3 · waterfall: Snov → Apollo → Hunter → pattern",
      });
    }, 4000);
    const progressTimer2 = setTimeout(() => {
      toast.loading("📧 Sending emails…", {
        id: toastId,
        description: "Step 3 of 3 · suppression-checked + CAN-SPAM compliant",
      });
    }, 12000);

    const { data, error } = await supabase.functions.invoke("contractor-outreach-auto-blast", {
      body: { lead_id: leadId, price, max_contractors: max, target_email_count: max },
    });
    clearTimeout(progressTimer);
    clearTimeout(progressTimer2);
    setBlastingLeadId(null);

    if (error) { toast.error(error.message, { id: toastId }); return; }
    const d = data as any;
    if (!d?.ok) {
      toast.error(d?.error || "Auto-blast failed", {
        id: toastId,
        description: d?.steps?.slice(-2).join(" · ") || "See console for details",
        duration: 10000,
      });
      console.warn("auto-blast trace", d);
      return;
    }
    toast.success(`✅ Sent ${d.sent} of ${d.attempted} contractors`, {
      id: toastId,
      description: `Scraped ${d.scraped || 0} · enriched ${d.enriched || 0} · suppressed ${d.skipped_suppressed || 0}${d.failures?.length ? ` · ${d.failures.length} failures` : ""}`,
      duration: 8000,
    });
    load();
  }

  async function deleteProspect(id: string) {
    if (!confirm("Remove this prospect?")) return;
    const { error } = await supabase.from("contractor_outreach_prospects" as never).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    load();
  }

  async function sendQuickSms(p: Prospect) {
    if (!p.phone) { toast.error("No phone on file"); return; }
    if (!p.consent_for_sms) {
      toast.error("Mark consent first (consent button on the row)");
      return;
    }
    const msg = window.prompt(
      `Send SMS to ${p.business_name} (${p.phone})?\n\nMessage (STOP suffix added automatically):`,
      `Hi — Matt from Detroit Web Agency. New ${p.trade.toLowerCase()} lead in ${p.city || "your area"}, $59 to claim. Want it?`
    );
    if (!msg || !msg.trim()) return;
    const { data, error } = await supabase.functions.invoke("contractor-outreach-sms-send", {
      body: { prospect_id: p.id, message: msg.trim() },
    });
    if (error) { toast.error(error.message); return; }
    const d = data as any;
    if (!d?.ok) { toast.error(d?.error || "SMS failed"); return; }
    toast.success("✅ SMS sent");
    load();
  }

  const hideThreshold = globalSettings?.hide_demo_leads_below_score ?? 60;
  const filtered = prospects.filter(p => {
    if (filterTrade && p.trade !== filterTrade) return false;
    if (filterCity && !(p.city || "").toLowerCase().includes(filterCity.toLowerCase())) return false;
    if (filterTerritory && String(p.territory_priority) !== filterTerritory) return false;
    if ((p.quality_score ?? 0) < filterMinQuality) return false;
    if (hideDemo && p.is_demo && (p.quality_score ?? 0) < hideThreshold) return false;
    return true;
  });
  const withEmail = prospects.filter(p => p.email).length;
  const verifiedEmail = prospects.filter(p => p.email && p.email_verified).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-300">Contractor Outreach</h2>
          <p className="text-xs text-muted-foreground mt-1">Scrape contractors → enrich emails → cold-email lead offers (CAN-SPAM compliant)</p>
        </div>
        <button onClick={load} className="text-muted-foreground hover:text-foreground"><RefreshCw size={14} /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prospects</p>
          <p className="text-2xl font-black text-foreground">{prospects.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">With Email</p>
          <p className="text-2xl font-black text-cyan-400">{withEmail}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Need Enrich</p>
          <p className="text-2xl font-black text-amber-400">{prospects.length - withEmail}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Real Unclaimed Leads</p>
          <p className="text-2xl font-black text-emerald-400">{unclaimedLeads.length}</p>
        </div>
      </div>

      {/* Daily-cap meter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="font-bold text-foreground">📧 Email cap (today)</span>
            <span className={emailsToday >= DAILY_EMAIL_CAP ? "text-red-400 font-bold" : "text-muted-foreground"}>
              {emailsToday} / {DAILY_EMAIL_CAP}
            </span>
          </div>
          <div className="h-1.5 bg-background rounded overflow-hidden">
            <div
              className={`h-full ${emailsToday >= DAILY_EMAIL_CAP ? "bg-red-500" : emailsToday > DAILY_EMAIL_CAP * 0.8 ? "bg-amber-500" : "bg-cyan-500"}`}
              style={{ width: `${Math.min(100, (emailsToday / DAILY_EMAIL_CAP) * 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="font-bold text-foreground">📱 SMS cap (today)</span>
            <span className={smsToday >= DAILY_SMS_CAP ? "text-red-400 font-bold" : "text-muted-foreground"}>
              {smsToday} / {DAILY_SMS_CAP}
            </span>
          </div>
          <div className="h-1.5 bg-background rounded overflow-hidden">
            <div
              className={`h-full ${smsToday >= DAILY_SMS_CAP ? "bg-red-500" : smsToday > DAILY_SMS_CAP * 0.8 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, (smsToday / DAILY_SMS_CAP) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Info box explaining how the system works */}
      <OutreachInfoBox />

      {/* Global kill-switches */}
      <OutreachGlobalSettings onChange={setGlobalSettings} />

      {/* Provenance panel */}
      <OutreachProvenancePanel />

      {/* Suppression manager */}
      <OutreachSuppressionManager />

      {/* Audit log link */}
      <Link
        to="/dwa-admin/outreach-audit"
        className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded border border-cyan-700/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
      >
        <Activity size={12} /> Open full Outreach Audit Log →
      </Link>

      {/* Scrape panel */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Search size={13} /> Scrape Contractors (Google Maps)
        </h3>
        <div className="flex flex-wrap gap-2">
          <select
            value={scrapeTrade}
            onChange={e => setScrapeTrade(e.target.value)}
            className="bg-background border border-border rounded px-3 py-2 text-sm"
          >
            {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            value={scrapeCity}
            onChange={e => setScrapeCity(e.target.value)}
            placeholder="City"
            className="bg-background border border-border rounded px-3 py-2 text-sm flex-1 min-w-[160px]"
          />
          <button
            onClick={runScrape}
            disabled={scraping}
            className="px-4 py-2 rounded text-sm font-bold bg-cyan-500 text-slate-900 hover:bg-cyan-400 disabled:opacity-50"
          >
            {scraping ? "Scraping…" : "Scrape 20"}
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <p className="text-xs text-muted-foreground mb-2">
            <strong className="text-foreground">Statewide Michigan Sweep</strong> — serial Google Places across the curated MI city catalog (rate-limited, resumable, dedupes existing prospects).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runStatewideSweep("primary")}
              disabled={sweeping}
              className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {sweeping ? "Sweeping…" : "🗺️ Sweep Primary (Metro Detroit)"}
            </button>
            <button
              onClick={() => runStatewideSweep("secondary")}
              disabled={sweeping}
              className="px-3 py-1.5 rounded text-xs font-bold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
            >
              Sweep Secondary (GR/Lansing/Flint)
            </button>
            <button
              onClick={() => runStatewideSweep("tertiary")}
              disabled={sweeping}
              className="px-3 py-1.5 rounded text-xs font-bold bg-slate-600 text-white hover:bg-slate-500 disabled:opacity-50"
            >
              Sweep Tertiary (Up North/UP)
            </button>
          </div>
        </div>
      </div>

      {/* Email blast unclaimed leads */}
      {unclaimedLeads.length > 0 && (
        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-3 flex items-center gap-2">
            <Send size={13} /> Cold-Email Real Unclaimed Leads ({unclaimedLeads.length})
          </h3>
          <p className="text-[11px] text-emerald-200/70 mb-3 -mt-2">
            One press = scrape Google Maps → enrich emails (Snov/Apollo/Hunter waterfall) → cold-email matched contractors. Suppression + daily-cap enforced.
          </p>
          <div className="space-y-2">
            {unclaimedLeads.map(l => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 bg-card border border-border rounded p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {l.name} · {l.contractor_lead_sites?.trade || "?"} / {l.contractor_lead_sites?.city || "?"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{l.project_type || "—"}</p>
                </div>
                <button
                  onClick={() => blastLead(l.id)}
                  disabled={blastingLeadId === l.id}
                  title="Auto-blast: scrape Google Maps → enrich emails → cold-email matched contractors"
                  className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-500 text-slate-900 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {blastingLeadId === l.id ? "Auto-blasting…" : "⚡ Auto-Blast (scrape+enrich+email)"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* One-Press orchestrator */}
      <OnePressLauncher
        trades={filterTrade ? [filterTrade] : ["HVAC", "Plumbing", "Electrical"]}
        cities={filterCity ? [filterCity] : [scrapeCity]}
        channels={["email"]}
        maxProspects={50}
        minQualityScore={Math.max(50, filterMinQuality)}
      />

      {/* Prospect list */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Contractor Database ({filtered.length} of {prospects.length}) · {verifiedEmail} verified
          </h3>
          <div className="flex gap-2 flex-wrap">
            <select value={filterTrade} onChange={e => setFilterTrade(e.target.value)} className="bg-background border border-border text-xs px-2 py-1 rounded">
              <option value="">All trades</option>
              {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              placeholder="Filter city…"
              className="bg-background border border-border text-xs px-2 py-1 rounded w-32"
            />
            <select value={filterTerritory} onChange={e => setFilterTerritory(e.target.value)} className="bg-background border border-border text-xs px-2 py-1 rounded">
              <option value="">All territories</option>
              <option value="1">1 — Primary</option>
              <option value="2">2 — Secondary</option>
              <option value="3">3 — Opportunistic</option>
            </select>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              Min Q
              <input type="range" min={0} max={100} step={5} value={filterMinQuality} onChange={e => setFilterMinQuality(parseInt(e.target.value))} className="w-20 accent-cyan-500" />
              <span className="text-cyan-300 font-bold w-6 text-right">{filterMinQuality}</span>
            </label>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={hideDemo} onChange={e => setHideDemo(e.target.checked)} className="accent-cyan-500" />
              Hide demo
            </label>
          </div>
        </div>
        {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : (
          <div className="bg-card border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-background/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-2.5">Business</th>
                  <th className="text-left p-2.5">Trade / Terr</th>
                  <th className="text-left p-2.5">Quality</th>
                  <th className="text-left p-2.5">Email</th>
                  <th className="text-left p-2.5">Email OK?</th>
                  <th className="text-left p-2.5">Phone</th>
                  <th className="text-left p-2.5">SMS OK?</th>
                  <th className="text-left p-2.5">Sent</th>
                  <th className="text-right p-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">
                    No prospects match these filters — adjust filters or use the Scrape panel above
                  </td></tr>
                )}
                {filtered.map(p => {
                  const smsStatus = p.unsubscribed_at ? { label: "⛔ Unsub", color: "text-red-400" }
                    : !p.phone ? { label: "—", color: "text-muted-foreground" }
                    : !p.consent_for_sms ? { label: "🔴 No consent", color: "text-red-300" }
                    : { label: "🟢 Consented", color: "text-emerald-300" };
                  const emailStatus = p.unsubscribed_at ? { label: "⛔ Unsub", color: "text-red-400" }
                    : !p.email ? { label: "—", color: "text-muted-foreground" }
                    : p.consent_for_email ? { label: "🟢 Consented", color: "text-emerald-300" }
                    : { label: "🟡 Cold (CAN-SPAM)", color: "text-amber-300" };
                  const q = p.quality_score ?? 0;
                  const qColor = q >= 75 ? "bg-emerald-500/20 text-emerald-300"
                    : q >= 50 ? "bg-amber-500/20 text-amber-300"
                    : "bg-red-500/20 text-red-300";
                  return (
                  <tr key={p.id} className="border-t border-border hover:bg-background/30">
                    <td className="p-2.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        {p.business_name}
                        {p.is_demo && <span className="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-300">demo</span>}
                      </div>
                      {p.website && (
                        <a href={p.website} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-400 hover:underline inline-flex items-center gap-1">
                          site <ExternalLink size={9} />
                        </a>
                      )}
                    </td>
                    <td className="p-2.5 text-muted-foreground">
                      <div>{p.trade}</div>
                      <div className="text-[10px]">{p.city || "—"} · T{p.territory_priority}</div>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${qColor}`}>{q}</span>
                    </td>
                    <td className="p-2.5">
                      {p.email ? (
                        <span className={p.email_verified ? "text-emerald-300" : "text-amber-300"}>
                          {p.email}
                          {!p.email_verified && <span className="text-[9px] text-amber-500 ml-1">guess</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className={`p-2.5 text-[10px] ${emailStatus.color}`}>{emailStatus.label}</td>
                    <td className="p-2.5 text-muted-foreground">{p.phone || "—"}</td>
                    <td className={`p-2.5 text-[10px] ${smsStatus.color}`}>{smsStatus.label}</td>
                    <td className="p-2.5 text-muted-foreground">{p.email_send_count}</td>
                    <td className="p-2.5 text-right space-x-1 whitespace-nowrap">
                      {!p.email && (
                        <button
                          onClick={() => enrich(p.id)}
                          disabled={enrichingId === p.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/40 disabled:opacity-50"
                        >
                          <Sparkles size={10} /> {enrichingId === p.id ? "…" : "Enrich"}
                        </button>
                      )}
                      {p.email && !p.consent_for_email && !p.unsubscribed_at && (
                        <button
                          onClick={() => setConsentFor({ id: p.id, name: p.business_name, channel: "email" })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/40"
                          title="Mark explicit email consent received (e.g. opted in via form)"
                        >
                          <ShieldCheck size={10} /> Email-OK
                        </button>
                      )}
                      {p.phone && !p.consent_for_sms && !p.unsubscribed_at && (
                        <button
                          onClick={() => setConsentFor({ id: p.id, name: p.business_name, channel: "sms" })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40"
                          title="Mark SMS consent received"
                        >
                          <ShieldCheck size={10} /> SMS-OK
                        </button>
                      )}
                      {p.consent_for_sms && p.phone && !p.unsubscribed_at && (
                        <button
                          onClick={() => sendQuickSms(p)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40"
                        >
                          <MessageSquare size={10} /> SMS
                        </button>
                      )}
                      <button
                        onClick={() => setDiagnosticsFor(p.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-cyan-300 hover:bg-cyan-500/10"
                        title="Why isn't this lead being contacted?"
                      >
                        <Stethoscope size={10} /> Diagnose
                      </button>
                      <button
                        onClick={() => setAuditFor({ id: p.id, name: p.business_name })}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-300 hover:bg-slate-500/10"
                        title="View audit log"
                      >
                        <Activity size={10} /> Audit
                      </button>
                      <button
                        onClick={() => deleteProspect(p.id)}
                        className="inline-flex items-center px-2 py-1 rounded text-[10px] text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 size={10} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawers / dialogs */}
      <OutreachAuditDrawer
        prospectId={auditFor?.id ?? null}
        prospectName={auditFor?.name}
        onClose={() => setAuditFor(null)}
      />
      <OutreachConsentDialog
        prospectId={consentFor?.id ?? null}
        prospectName={consentFor?.name}
        channel={consentFor?.channel ?? "sms"}
        onClose={() => setConsentFor(null)}
        onSaved={load}
      />
      <LeadDiagnosticsDrawer
        prospectId={diagnosticsFor}
        open={diagnosticsFor !== null}
        onClose={() => setDiagnosticsFor(null)}
      />
    </div>
  );
}
