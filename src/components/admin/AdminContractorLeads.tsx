import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, Users, TrendingUp, Zap, CheckCircle, AlertTriangle,
  Phone, Clock, RefreshCw, ChevronDown, ChevronUp, Lock, Unlock,
  Copy, Facebook, Globe, Wrench, Activity, Send, HelpCircle, Info,
} from "lucide-react";
import { toast } from "sonner";
import TerritoryLinkGenerator from "@/components/dwa-admin/TerritoryLinkGenerator";
import ContractorLeadsInfoBox from "@/components/admin/ContractorLeadsInfoBox";
import ContractorOutreachPanel from "@/components/admin/ContractorOutreachPanel";

// ── Priority territories for first Facebook/prospector push ──────────────────
const PRIORITY_SLUGS = ["hvac-warren", "plumbing-detroit", "hvac-sterling-heights", "roofing-troy", "electrician-detroit"];

const TRADE_COLORS: Record<string, string> = {
  HVAC:       "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Plumbing:   "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  Electrical: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Roofing:    "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Boiler:     "bg-red-500/20 text-red-300 border-red-500/30",
  Gutters:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Siding:     "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

const ALL_TRADES = ["HVAC", "Plumbing", "Electrical", "Roofing", "Boiler", "Gutters", "Siding"];

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isStuck(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > 30 * 60 * 1000;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

// ── Section: Stat Cards ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AdminContractorLeads() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "https://zmyczlfuufhngzovkjdh.supabase.co";

  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [fbInputs, setFbInputs] = useState<Record<string, string>>({});
  const [savingFb, setSavingFb] = useState<string | null>(null);
  const [prospectorTrade, setProspectorTrade] = useState("HVAC contractor");
  const [prospectorCity, setProspectorCity] = useState("Warren MI");
  const [runningProspector, setRunningProspector] = useState(false);
  const [markedCalled, setMarkedCalled] = useState<Set<string>>(new Set());
  const [showFbGuide, setShowFbGuide] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState("all");
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickForm, setQuickForm] = useState({ site_id: "", name: "", phone: "", email: "", description: "" });
  const [submittingLead, setSubmittingLead] = useState(false);
  const [newTrade, setNewTrade] = useState("");
  const [newCity, setNewCity] = useState("");
  const [addingTerritory, setAddingTerritory] = useState(false);

  const load = useCallback(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [terrRes, clientRes, leadRes, pipeRes] = await Promise.all([
      supabase.from("contractor_lead_sites" as never).select("*").order("trade, city"),
      supabase.from("contractor_clients" as never).select("*").order("created_at", { ascending: false }),
      supabase.from("contractor_leads" as never)
        .select("*, contractor_lead_sites(trade, city, slug)")
        .order("created_at", { ascending: false }).limit(200),
      supabase.from("outreach_leads" as never)
        .select("*")
        .or("offer_pitched.eq.leads,industry.ilike.%hvac%,industry.ilike.%plumb%,industry.ilike.%roof%,industry.ilike.%electric%")
        .order("created_at", { ascending: false }).limit(150),
    ]);

    setTerritories((terrRes.data as any[]) || []);
    setClients((clientRes.data as any[]) || []);
    setLeads((leadRes.data as any[]) || []);
    setPipeline((pipeRes.data as any[]) || []);
    setLoading(false);
    void [thirtyDaysAgo, sevenDaysAgo]; // used in derived values below
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => { load(); setLastRefresh(Date.now()); }, 60000);
    return () => clearInterval(interval);
  }, [load]);

  // ── Add territory ─────────────────────────────────────────────────────────
  async function addTerritory() {
    if (!newTrade || !newCity.trim()) { toast.error("Trade and city are required"); return; }
    setAddingTerritory(true);
    const slug = `${newTrade.toLowerCase()}-${newCity.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`;
    const { error } = await supabase.from("contractor_lead_sites" as never).insert({
      trade: newTrade, city: newCity.trim(), state: "MI", slug, active: true,
    } as never);
    setAddingTerritory(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${newTrade} — ${newCity} added`);
    setNewTrade(""); setNewCity("");
    load();
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const activeClients = clients.filter((c) => c.active);
  const trialClients = clients.filter(
    (c) => c.active && c.onboarded_at && Date.now() - new Date(c.onboarded_at).getTime() < 7 * 24 * 60 * 60 * 1000
  );
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const leadsThisMonth = leads.filter((l) => l.created_at > thirtyDaysAgo);
  const deliveredCount = leads.filter((l) => l.notified_at).length;

  // Compute lead counts per territory slug
  const leadsBySlug: Record<string, number> = {};
  leads.forEach((l) => {
    const slug = (l.contractor_lead_sites as any)?.slug;
    if (slug) leadsBySlug[slug] = (leadsBySlug[slug] || 0) + 1;
  });

  // Unassigned stuck leads
  const stuckLeads = leads.filter(
    (l) => !l.client_id && l.status === "new" && isStuck(l.created_at)
  );

  // Priority empty territories
  const priorityEmpty = territories.filter(
    (t) => PRIORITY_SLUGS.includes(t.slug) && !t.active_contractor_id
  );

  // Find contractor name for a territory
  const contractorFor = (t: any) =>
    clients.find((c) => c.id === t.active_contractor_id);

  // Pipeline filter
  const filteredPipeline = pipelineFilter === "all"
    ? pipeline
    : pipeline.filter((p) => p.offer_pitched === pipelineFilter || p.status === pipelineFilter);

  // ── Quick Lead Entry ───────────────────────────────────────────────────────
  const submitQuickLead = async () => {
    if (!quickForm.site_id || !quickForm.name.trim() || !quickForm.phone.trim()) {
      toast.error("Trade/city, name, and phone are required");
      return;
    }
    setSubmittingLead(true);
    try {
      const phone = quickForm.phone.replace(/\D/g, "");
      const e164 = phone.length === 10 ? `+1${phone}` : phone.length === 11 ? `+${phone}` : quickForm.phone;
      const { data: lead, error } = await supabase
        .from("contractor_leads" as never)
        .insert({
          site_id: quickForm.site_id,
          name: quickForm.name.trim(),
          phone: e164,
          email: quickForm.email.trim() || null,
          project_type: quickForm.description.trim() || null,
          source: "admin-manual",
          status: "new",
        } as never)
        .select("id")
        .single();
      if (error || !lead) throw new Error((error as any)?.message || "Insert failed");
      await supabase.functions.invoke("contractor-lead-notify", { body: { lead_id: (lead as any).id } });
      toast.success("Lead added — contractors notified");
      setQuickForm({ site_id: "", name: "", phone: "", email: "", description: "" });
      setShowQuickAdd(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmittingLead(false);
    }
  };

  // ── Save Facebook page ID ──────────────────────────────────────────────────
  const saveFbPageId = async (territoryId: string, pageId: string) => {
    if (!pageId.trim()) return;
    setSavingFb(territoryId);
    const { error } = await supabase
      .from("contractor_lead_sites" as never)
      .update({ facebook_page_id: pageId.trim() } as never)
      .eq("id", territoryId);
    if (error) {
      toast.error("Failed to save page ID");
    } else {
      toast.success("Facebook page ID saved");
      setFbInputs((prev) => ({ ...prev, [territoryId]: "" }));
      load();
    }
    setSavingFb(null);
  };

  // ── Run prospector for specific territory ─────────────────────────────────
  const runProspector = async () => {
    setRunningProspector(true);
    const { error } = await supabase.functions.invoke("contractor-prospector", {
      body: { target_trade: prospectorTrade, target_city: prospectorCity },
    });
    if (error) {
      toast.error("Prospector error: " + error.message);
    } else {
      toast.success(`Prospector launched for ${prospectorTrade} in ${prospectorCity}`);
      setTimeout(load, 3000);
    }
    setRunningProspector(false);
  };

  // ── À la carte: sell a single unclaimed lead ──────────────────────────────
  const [sellingLeadId, setSellingLeadId] = useState<string | null>(null);
  const sellLead = async (leadId: string) => {
    const priceStr = window.prompt("Price to charge contractors (USD)? Suggested: 39, 59, or 99", "59");
    if (!priceStr) return;
    const price = parseInt(priceStr, 10);
    if (!Number.isFinite(price) || price < 1 || price > 1000) { toast.error("Price must be 1-1000"); return; }
    setSellingLeadId(leadId);
    try {
      const { data, error } = await supabase.functions.invoke("sell-lead-alacarte", {
        body: { lead_id: leadId, price_cents: price * 100, max_candidates: 3 },
      });
      if (error) throw error;
      const d = data as any;
      if (!d?.ok) throw new Error(d?.error || "sell failed");
      toast.success(`💰 Offer sent — ${d.sent?.sms ?? 0} SMS · ${d.sent?.email ?? 0} email · ${d.candidates?.length ?? 0} contractors notified`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to sell lead");
    } finally {
      setSellingLeadId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Activity size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  const hasActions = stuckLeads.length > 0 || trialClients.length > 0 || priorityEmpty.length > 0;

  return (
    <div className="space-y-8 pb-12">

      {/* ── Info Box (replaces old explainer) ─────────────────────────── */}
      <ContractorLeadsInfoBox />

      {/* ── Territory Signup Link Generator ──────────────────────────────── */}
      <TerritoryLinkGenerator />

      {/* ── Quick Lead Entry ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Lead Entry</h2>
          <button
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: "#e8621a", color: "#fff" }}
          >
            {showQuickAdd ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showQuickAdd ? "Close" : "Add Lead"}
          </button>
        </div>
        {showQuickAdd && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground font-semibold mb-1">TRADE + CITY *</label>
                <select
                  value={quickForm.site_id}
                  onChange={e => setQuickForm(f => ({ ...f, site_id: e.target.value }))}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Select territory…</option>
                  {territories.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.trade} — {t.city}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground font-semibold mb-1">HOMEOWNER NAME *</label>
                <input
                  value={quickForm.name}
                  onChange={e => setQuickForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="John Smith"
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground font-semibold mb-1">PHONE *</label>
                <input
                  value={quickForm.phone}
                  onChange={e => setQuickForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="3135551234"
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground font-semibold mb-1">EMAIL</label>
                <input
                  value={quickForm.email}
                  onChange={e => setQuickForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="john@email.com"
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground font-semibold mb-1">PROJECT DESCRIPTION</label>
                <input
                  value={quickForm.description}
                  onChange={e => setQuickForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Furnace replacement, 2,000 sq ft home…"
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={submitQuickLead}
                disabled={submittingLead}
                className="text-sm font-bold px-4 py-2 rounded-md disabled:opacity-60"
                style={{ background: "#e8621a", color: "#fff" }}
              >
                {submittingLead ? "Adding…" : "Add Lead + Notify"}
              </button>
              <button
                onClick={() => setShowQuickAdd(false)}
                className="text-sm px-4 py-2 rounded-md border border-border text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 1: Revenue Header ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Contractor Leads — Revenue</h2>
          <button onClick={() => { load(); setLastRefresh(Date.now()); }} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Monthly MRR" value={`$${(activeClients.length * 399).toLocaleString()}`} sub={`${activeClients.length} active territories`} icon={DollarSign} color="#22c55e" />
          <StatCard label="Open Upside" value={`$${((territories.length - activeClients.length) * 399).toLocaleString()}/mo`} sub={`${territories.length - activeClients.length} territories unclaimed`} icon={TrendingUp} color="#f59e0b" />
          <StatCard label="Leads This Month" value={leadsThisMonth.length} sub="across all territories" icon={Users} color="#3b82f6" />
          <StatCard label="Delivered" value={deliveredCount} sub={`${leads.length > 0 ? Math.round((deliveredCount / leads.length) * 100) : 0}% delivery rate`} icon={CheckCircle} color="#e8621a" />
        </div>
      </div>

      {/* ── Section 2: Matt's Action Queue ───────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Action Queue</h2>
        {!hasActions ? (
          <div className="bg-green-950/20 border border-green-900/30 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle size={18} className="text-green-500" />
            <p className="text-sm font-medium text-green-300">All systems running — no actions needed</p>
            <span className="text-xs text-muted-foreground ml-auto">Refreshed {timeAgo(new Date(lastRefresh).toISOString())}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Stuck leads */}
            {stuckLeads.map((l) => (
              <div key={l.id} className="bg-red-950/20 border border-red-900/40 rounded-lg p-4 flex flex-wrap items-center gap-3">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Undelivered lead — {(l.contractor_lead_sites as any)?.trade || "Unknown"} / {(l.contractor_lead_sites as any)?.city || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{l.name} — {l.phone} — {timeAgo(l.created_at)}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(`${l.name}\n${l.phone}\n${l.email || ""}`, "Lead details")}
                  className="flex items-center gap-1 bg-card border border-border px-3 py-1.5 rounded text-xs font-medium hover:border-primary/50 transition-colors"
                >
                  <Copy size={12} /> Copy Details
                </button>
              </div>
            ))}

            {/* New trial contractors */}
            {trialClients.filter((c) => !markedCalled.has(c.id)).map((c) => (
              <div key={c.id} className="bg-blue-950/20 border border-blue-900/40 rounded-lg p-4 flex flex-wrap items-center gap-3">
                <Phone size={16} className="text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">New trial — make welcome call</p>
                  <p className="text-xs text-muted-foreground">{c.business_name || c.name} — {c.trade} / {c.city} — started {timeAgo(c.onboarded_at)}</p>
                </div>
                <button
                  onClick={() => setMarkedCalled((prev) => new Set([...prev, c.id]))}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                >
                  <CheckCircle size={12} /> Mark Called
                </button>
              </div>
            ))}

            {/* Priority empty territories */}
            {priorityEmpty.map((t) => (
              <div key={t.id} className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-4 flex flex-wrap items-center gap-3">
                <Zap size={16} className="text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Priority territory empty — {t.trade} / {t.city}</p>
                  <p className="text-xs text-muted-foreground">{leadsBySlug[t.slug] || 0} leads captured this month — no contractor to deliver to</p>
                </div>
                <button
                  onClick={() => { setProspectorTrade(`${t.trade.toLowerCase()} contractor`); setProspectorCity(`${t.city} MI`); document.getElementById("prospector-section")?.scrollIntoView({ behavior: "smooth" }); }}
                  className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                >
                  <Send size={12} /> Run Prospector
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3: Territory Grid ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Territory Status ({territories.length} Territories)</h2>
            <button
              type="button"
              onClick={() => setShowFbGuide((v) => !v)}
              className="text-blue-400 hover:text-blue-300"
              title="What is FB Page ID?"
            >
              <HelpCircle size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select value={newTrade} onChange={e => setNewTrade(e.target.value)} className="bg-background border border-border text-xs text-foreground px-2 py-1.5 rounded focus:outline-none focus:border-primary">
              <option value="">Trade…</option>
              {ALL_TRADES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="City name" className="bg-background border border-border text-xs text-foreground px-2 py-1.5 rounded focus:outline-none focus:border-primary w-32" onKeyDown={e => e.key === "Enter" && addTerritory()} />
            <button onClick={addTerritory} disabled={addingTerritory || !newTrade || !newCity.trim()} className="text-xs font-bold px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40">
              {addingTerritory ? "…" : "+ Add"}
            </button>
          </div>
        </div>
        {showFbGuide && (
          <div className="mb-3 bg-blue-950/30 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-100 leading-relaxed">
            <strong className="text-blue-300">What is "FB Page ID"?</strong> When a contractor wires their Facebook Lead Form to your territory, paste their Facebook Page ID here so incoming Facebook leads route to <em>them</em> automatically. Find it at <code className="bg-black/40 px-1 py-0.5 rounded text-[10px]">facebook.com/[their-page]/about</code> → Page Transparency. Without it, FB leads land in a generic bucket. Don't have a contractor for this slot yet? Use the Prospecting Pipeline below to find one.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {territories.map((t) => {
            const contractor = contractorFor(t);
            const leadsCount = leadsBySlug[t.slug] || 0;
            const isTaken = !!t.active_contractor_id;
            const fbInput = fbInputs[t.id] || "";
            const isPriority = PRIORITY_SLUGS.includes(t.slug);

            return (
              <div
                key={t.id}
                className={`border rounded-lg p-4 ${isTaken ? "bg-green-950/10 border-green-900/30" : "bg-amber-950/10 border-amber-900/30"} ${isPriority && !isTaken ? "ring-1 ring-amber-500/40" : ""}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mr-2 ${TRADE_COLORS[t.trade] || "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}>
                      {t.trade}
                    </span>
                    {isPriority && !isTaken && <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">PRIORITY</span>}
                  </div>
                  {isTaken ? <Lock size={14} className="text-green-400 flex-shrink-0" /> : <Unlock size={14} className="text-amber-400 flex-shrink-0" />}
                </div>

                <p className="font-bold text-sm text-foreground">{t.city}, {t.state}</p>

                {isTaken ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-green-300 font-medium">{contractor?.business_name || contractor?.name || "Contractor assigned"}</p>
                    <p className="text-xs text-muted-foreground">{leadsCount} leads this month · $399/mo</p>
                    {t.facebook_page_id
                      ? <span className="inline-flex items-center gap-1 text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full"><Facebook size={9} /> FB wired</span>
                      : <span className="text-[10px] text-muted-foreground">FB not wired</span>
                    }
                    <button
                      onClick={async () => {
                        if (!confirm(`Unlock ${t.trade} / ${t.city}? This frees the territory for a new contractor.`)) return;
                        const { error } = await supabase
                          .from("contractor_lead_sites" as never)
                          .update({ active_contractor_id: null } as never)
                          .eq("id", t.id);
                        if (error) toast.error(error.message);
                        else { toast.success("Territory unlocked"); load(); }
                      }}
                      className="block w-full mt-1 text-[10px] font-bold px-2 py-1 rounded bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/40"
                    >
                      🔓 Unlock Territory
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">{leadsCount} leads captured · $399/mo unclaimed</p>
                    {t.facebook_page_id ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full"><Facebook size={9} /> FB wired</span>
                    ) : (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="FB Page ID"
                          value={fbInput}
                          onChange={(e) => setFbInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          className="flex-1 bg-slate-800 border border-slate-600 text-white px-2 py-1 text-xs rounded placeholder:text-slate-500 min-w-0"
                        />
                        <button
                          onClick={() => saveFbPageId(t.id, fbInput)}
                          disabled={savingFb === t.id || !fbInput.trim()}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {savingFb === t.id ? "…" : "Set"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Live Lead Feed ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Live Lead Feed</h2>
          <button
            onClick={async () => {
              const demoCount = leads.filter(l => l.is_demo_record).length;
              if (demoCount === 0) { toast.info("No demo leads to clear"); return; }
              if (!confirm(`Delete ${demoCount} demo leads? This cannot be undone.`)) return;
              const { error } = await supabase.from("contractor_leads" as never).delete().eq("is_demo_record", true);
              if (error) toast.error(error.message);
              else { toast.success(`Cleared ${demoCount} demo leads`); load(); }
            }}
            className="text-[10px] font-bold px-2 py-1 rounded bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/40"
          >
            🗑️ Clear Demo Leads
          </button>
        </div>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Time</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 hidden sm:table-cell">Phone</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 hidden md:table-cell">Territory</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Source</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Status</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">Sell</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 50).map((l) => {
                const stuck = l.status === "new" && isStuck(l.created_at) && !l.client_id;
                const territory = l.contractor_lead_sites as any;
                const isExpanded = expandedLead === l.id;

                return [
                  <tr
                    key={l.id}
                    className={`border-t border-border cursor-pointer hover:bg-muted/20 transition-colors ${stuck ? "bg-red-950/20" : ""}`}
                    onClick={() => setExpandedLead(isExpanded ? null : l.id)}
                  >
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(l.created_at)}</td>
                    <td className="px-3 py-2 text-xs font-medium text-foreground">
                      {l.name}
                      {l.is_demo_record && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">DEMO</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">
                      <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary">{l.phone}</a>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {territory ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TRADE_COLORS[territory.trade] || "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}>
                          {territory.trade} / {territory.city}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">Unknown</span>}
                    </td>
                    <td className="px-3 py-2">
                      {l.source === "facebook" ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">Facebook</span>
                      ) : l.source === "seo_page" ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">SEO</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30">Direct</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {stuck ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">Stuck</span>
                      ) : l.notified_at ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">Delivered</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">New</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {!l.client_id ? (
                        <button
                          onClick={() => sellLead(l.id)}
                          disabled={sellingLeadId === l.id}
                          className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 whitespace-nowrap"
                          title="Generate Stripe link + notify nearby contractors"
                        >
                          {sellingLeadId === l.id ? "…" : "💵 Sell"}
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">claimed</span>
                      )}
                    </td>
                  </tr>,
                  isExpanded && (
                    <tr key={`${l.id}-expand`} className="border-t border-border bg-muted/10">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          {l.email && <span><strong className="text-foreground">Email:</strong> {l.email}</span>}
                          {l.project_type && <span><strong className="text-foreground">Project:</strong> {l.project_type}</span>}
                          {l.message && <span><strong className="text-foreground">Notes:</strong> {l.message}</span>}
                          <span><strong className="text-foreground">Created:</strong> {new Date(l.created_at).toLocaleString()}</span>
                          {l.notified_at && <span><strong className="text-foreground">Notified:</strong> {new Date(l.notified_at).toLocaleString()}</span>}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">No leads yet — SEO pages are live, waiting for first homeowner.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 5: Prospecting Pipeline ──────────────────────────────── */}
      <div id="prospector-section">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Prospecting Pipeline</h2>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select
              value={pipelineFilter}
              onChange={(e) => setPipelineFilter(e.target.value)}
              className="bg-card border border-border text-foreground px-2 py-1 text-xs rounded"
            >
              <option value="all">All offers</option>
              <option value="leads">Leads only</option>
              <option value="gbp">GBP only</option>
              <option value="missed_call">Missed Call only</option>
            </select>
            <select
              value={prospectorTrade}
              onChange={(e) => setProspectorTrade(e.target.value)}
              className="bg-card border border-border text-foreground px-2 py-1 text-xs rounded"
            >
              <option value="HVAC contractor">HVAC</option>
              <option value="plumber">Plumber</option>
              <option value="roofer">Roofer</option>
              <option value="electrician">Electrician</option>
            </select>
            <select
              value={prospectorCity}
              onChange={(e) => setProspectorCity(e.target.value)}
              className="bg-card border border-border text-foreground px-2 py-1 text-xs rounded"
            >
              <option value="Warren MI">Warren</option>
              <option value="Detroit MI">Detroit</option>
              <option value="Sterling Heights MI">Sterling Heights</option>
              <option value="Troy MI">Troy</option>
              <option value="Livonia MI">Livonia</option>
              <option value="Dearborn MI">Dearborn</option>
              <option value="Grosse Pointe MI">Grosse Pointe</option>
              <option value="Southfield MI">Southfield</option>
            </select>
            <Button
              size="sm"
              onClick={runProspector}
              disabled={runningProspector}
              className="text-xs h-7 gap-1"
            >
              {runningProspector ? <Activity size={12} className="animate-spin" /> : <Send size={12} />}
              Run Prospector
            </Button>
          </div>
        </div>

        <div className="flex gap-4 mb-3">
          {[
            { label: "In pipeline", count: pipeline.length, color: "text-foreground" },
            { label: "Emailed", count: pipeline.filter((p) => p.status === "emailed" || p.status === "contacted").length, color: "text-blue-400" },
            { label: "Leads offer", count: pipeline.filter((p) => p.offer_pitched === "leads").length, color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="text-xs">
              <span className={`font-bold text-sm ${s.color}`}>{s.count}</span>
              <span className="text-muted-foreground ml-1">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Business</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 hidden sm:table-cell">City</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Offer</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 hidden md:table-cell">Emails</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 hidden md:table-cell">SMS</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPipeline.slice(0, 80).map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs font-medium text-foreground">{p.business_name || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{p.city || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${p.offer_pitched === "leads" ? "bg-primary/20 text-primary border-primary/30" : p.offer_pitched === "gbp" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}>
                      {p.offer_pitched || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <div className="flex gap-0.5">
                      {["D0", "D4", "D8", "D15"].map((d, i) => (
                        <span key={d} className={`text-[9px] px-1 py-0.5 rounded ${i === 0 && p.status === "emailed" ? "bg-green-500/30 text-green-300" : i > 0 && p.last_contact_date ? "bg-blue-500/20 text-blue-300" : "bg-muted/30 text-muted-foreground"}`}>{d}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">{p.sms_sent ? (p.sms_2_sent ? "2 sent" : "1 sent") : "—"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-[10px] text-muted-foreground">{p.status || "lead_found"}</span>
                  </td>
                </tr>
              ))}
              {filteredPipeline.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">No pipeline entries yet. The prospector runs daily at 11am ET automatically.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 6: Automation Health ─────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Automation Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: "Lead Notify", schedule: "Every 15 min", desc: "Retries unnotified leads" },
            { name: "Health Monitor", schedule: "Every 30 min", desc: "Alerts Matt if leads stuck" },
            { name: "Prospector", schedule: "Daily 11am ET", desc: "Finds contractors via Google Maps, sends AI cold emails" },
            { name: "Drip Sequences", schedule: "Daily 12pm ET", desc: "Day 4/8/15 email follow-ups" },
            { name: "SMS Follow-Up", schedule: "Daily 2pm ET", desc: "2-step SMS after initial email" },
            { name: "Facebook Webhook", schedule: "Event-driven", desc: "Routes FB Lead Ads to territories in real-time" },
          ].map((fn) => (
            <div key={fn.name} className="bg-card border border-border rounded-lg p-3 flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mt-1 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-foreground">{fn.name}</p>
                <p className="text-[11px] text-primary">{fn.schedule}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{fn.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 7: Facebook Lead Ads Setup Guide ─────────────────────── */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowFbGuide(!showFbGuide)}
          className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/20 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Facebook size={16} className="text-blue-400" />
            <span className="text-sm font-bold text-foreground">Facebook Lead Ads — Setup Guide</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">Step-by-step</span>
          </div>
          {showFbGuide ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </button>

        {showFbGuide && (
          <div className="px-4 pb-5 pt-3 bg-card border-t border-border space-y-4 text-sm text-muted-foreground">
            <p className="text-xs text-muted-foreground">The Facebook webhook is already built and deployed. Complete the one-time setup below per territory to start receiving leads from Facebook ads.</p>

            {[
              { step: 1, title: "Create a Facebook Page per trade", body: 'Create a Facebook Business Page for each target trade, e.g. "Warren HVAC Pros" or "Detroit Plumbing Service". This becomes the lead source.' },
              { step: 2, title: 'Create a Lead Ad with these required fields', body: 'In Ads Manager → Lead gen objective → Instant Form: required fields must include full_name, phone_number, and email. Optional: service_needed (maps to project_type).' },
              { step: 3, title: "Wire the Facebook webhook", body: null },
              { step: 4, title: "Set the Page ID per territory (above)", body: 'Copy the Page ID from Facebook Business Suite (it\'s a number like 123456789). Paste it into the "Setup Facebook" field on the territory card above and click Set.' },
              { step: 5, title: "Test with Facebook's test lead tool", body: 'In Facebook Ads Manager → Lead Ad Form → Preview → Send Test Lead. The lead should appear in the Live Lead Feed above within 30 seconds.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-3">
                <div className="w-6 h-6 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-blue-300">{step}</span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-xs mb-1">{title}</p>
                  {body && <p className="text-xs leading-relaxed">{body}</p>}
                  {step === 3 && (
                    <div className="bg-slate-900 border border-slate-700 rounded p-3 text-xs font-mono space-y-1 mt-1">
                      <p className="text-slate-400">In Facebook Developer Console → App → Webhooks → Page → leadgen field:</p>
                      <p><span className="text-slate-400">Callback URL: </span><span className="text-green-300">{supabaseUrl}/functions/v1/facebook-lead-webhook</span></p>
                      <p><span className="text-slate-400">Verify Token: </span><span className="text-yellow-300">set FACEBOOK_WEBHOOK_VERIFY_TOKEN in Supabase secrets — same value here</span></p>
                      <p><span className="text-slate-400">Also set: </span><span className="text-yellow-300">FACEBOOK_PAGE_TOKEN (Page Access Token from Meta Business Suite)</span></p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
      {/* ── Section 8: Contractor Outreach (cold-email leads) ─────────── */}
      <ContractorOutreachPanel />
    </div>
  );
}
