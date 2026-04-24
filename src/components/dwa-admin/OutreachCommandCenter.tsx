import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2, Search, Download, Shield, Mail, Phone, Printer, MessageSquare, Sparkles, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ---------- Types ----------
type Prospect = {
  id: string;
  business_name: string;
  contact_name: string | null;
  audience_type: string;
  channel_hint: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  phone: string | null;
  fax_number: string | null;
  email: string | null;
  address_line1: string | null;
  website: string | null;
  lead_score: number;
  intel_notes: unknown;
  status: string;
  last_sent_at: string | null;
  send_count: number;
  source: string;
  google_rating?: number | null;
  review_count?: number | null;
  phone_carrier_type?: string | null;
  has_breach?: boolean | null;
  last_enriched_at?: string | null;
  enrichment_status?: string | null;
  meta?: Record<string, any> | null;
};

type EnrichTrace = { source: string; filled: string[]; cost_usd: number; duration_ms: number; ok: boolean; error?: string };

function getTrace(p: Prospect): EnrichTrace[] {
  const t = p.meta?.enrichment_trace;
  return Array.isArray(t) ? t : [];
}

function sourceFor(p: Prospect, field: string): string | null {
  for (const t of getTrace(p)) {
    if (t.filled.includes(field)) return t.source;
  }
  return null;
}

const AUDIENCES = [
  { id: "hvac", label: "HVAC" },
  { id: "plumbing", label: "Plumbing" },
  { id: "roofing", label: "Roofing" },
  { id: "electrical", label: "Electrical" },
  { id: "general_contractor", label: "General Contractor" },
  { id: "nursing_home", label: "Nursing Home" },
  { id: "supply_house", label: "Supply House" },
  { id: "healthcare_staffing", label: "Healthcare Staffing" },
  { id: "trades_staffing", label: "Trades Staffing" },
  { id: "industrial_mfg", label: "Industrial Mfg" },
  { id: "senior_care", label: "Senior Care" },
];

const CHANNELS = ["any", "email", "postcard", "fax", "phone"] as const;

type SubTab = "find" | "ranked" | "campaigns" | "compliance";

// ============================================================
// MAIN
// ============================================================
export default function OutreachCommandCenter() {
  const [sub, setSub] = useState<SubTab>("find");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            🎯 Outreach <span className="text-[#00d4ff]">Command Center</span>
          </h1>
          <p className="text-white/50 text-xs mt-1">
            Single brain for finding, ranking, and pitching prospects across email · postcard · fax · SMS
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {[
          { id: "find" as const,       label: "🔍 Find Prospects" },
          { id: "ranked" as const,     label: "📊 Ranked Pool" },
          { id: "campaigns" as const,  label: "📡 Active Campaigns" },
          { id: "compliance" as const, label: "🛡️ Compliance" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-semibold transition-colors",
              sub === t.id
                ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-transparent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "find"       && <FindProspects />}
      {sub === "ranked"     && <RankedPool />}
      {sub === "campaigns"  && <ActiveCampaigns />}
      {sub === "compliance" && <Compliance />}
    </div>
  );
}

// ============================================================
// Provider Health chip row — shows credits + 429 status per email enrichment provider
// ============================================================
function ProviderHealthRow() {
  const { data } = useQuery({
    queryKey: ["enrichment-provider-health"],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrichment_provider_health")
        .select("provider, credits_remaining, last_429_at, daily_calls, daily_hits");
      return data ?? [];
    },
    refetchInterval: 30_000,
  });
  if (!data || data.length === 0) return null;
  const order = ["snov", "apollo", "pattern_verify", "hunter", "pdl", "site_scrape"];
  const sorted = [...data].sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {sorted.map((p: any) => {
        const recently429 = p.last_429_at && (Date.now() - new Date(p.last_429_at).getTime() < 60 * 60 * 1000);
        const dead = typeof p.credits_remaining === "number" && p.credits_remaining <= 0;
        const dot = dead ? "🔴" : recently429 ? "🟡" : "🟢";
        const credits = typeof p.credits_remaining === "number" ? p.credits_remaining.toLocaleString() : "—";
        return (
          <span
            key={p.provider}
            title={`${p.daily_hits ?? 0}/${p.daily_calls ?? 0} hits today`}
            className="text-[11px] px-2 py-0.5 rounded bg-black/30 border border-white/10 text-white/70"
          >
            {dot} {p.provider.replace("_", " ")} · {credits}
          </span>
        );
      })}
    </div>
  );
}

// ============================================================
// SUB-TAB 1 — Find Prospects (Targeting Engine)
// ============================================================
function FindProspects() {
  const [audience, setAudience] = useState("hvac");
  const [county, setCounty] = useState("");
  const [limit, setLimit] = useState(50);
  const [running, setRunning] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [enrichFirst, setEnrichFirst] = useState(false);
  const qc = useQueryClient();

  // Idle Pool counts
  const { data: idleStats, refetch: refetchIdle } = useQuery({
    queryKey: ["idle-prospect-pool"],
    queryFn: async () => {
      const { data: all } = await supabase
        .from("prospect_pipeline")
        .select("industry, email, last_drip_at, pipeline_stage")
        .neq("pipeline_stage", "archived")
        .limit(1000);
      const rows = all ?? [];
      const total = rows.length;
      const missingEmail = rows.filter((r: any) => !r.email).length;
      const neverContacted = rows.filter((r: any) => !r.last_drip_at).length;
      const byIndustry: Record<string, { total: number; hasEmail: number }> = {};
      for (const r of rows as any[]) {
        const k = r.industry || "Unknown";
        if (!byIndustry[k]) byIndustry[k] = { total: 0, hasEmail: 0 };
        byIndustry[k].total++;
        if (r.email) byIndustry[k].hasEmail++;
      }
      const top = Object.entries(byIndustry)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 6);
      return { total, missingEmail, neverContacted, top };
    },
  });

  const [backfilling, setBackfilling] = useState(false);
  const [activating, setActivating] = useState(false);

  async function runBackfill() {
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("prospect-email-backfill", {
        body: { limit: 50 },
      });
      if (error) throw error;
      const c = data?.counters || {};
      const breakdown = ["snov","apollo","pattern_verify","hunter","pdl","site_scrape"]
        .map((k) => `${k.replace("_"," ")}: ${c[k] ?? 0}`)
        .join(" · ");
      toast.success(
        `Enriched ${data?.enriched ?? 0} of ${data?.processed ?? 0} prospects — ${breakdown}`
      );
      refetchIdle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  async function runActivate() {
    // Dry run first to preview
    const { data: preview, error: pErr } = await supabase.functions.invoke("activate-idle-prospects", {
      body: { dry_run: true },
    });
    if (pErr) {
      toast.error(pErr.message || "Preview failed");
      return;
    }
    const count = preview?.eligible_count ?? 0;
    if (count === 0) {
      toast.info("No eligible prospects (need email + mapped industry)");
      return;
    }
    if (!confirm(`Activate drip for ${count} prospects across ${Object.keys(preview?.by_industry || {}).length} industries? They'll get emailed starting tomorrow morning.`)) return;

    setActivating(true);
    try {
      const { data, error } = await supabase.functions.invoke("activate-idle-prospects", {
        body: {},
      });
      if (error) throw error;
      toast.success(`Activated ${data?.activated ?? 0} prospects — drip starts tomorrow AM`);
      refetchIdle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  async function runScrape() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("targeting-prospect-scraper", {
        body: { audience_type: audience, county: county || undefined, limit },
      });
      if (error) throw error;
      toast.success(`Scrape complete: ${data?.inserted ?? 0} new, ${data?.total ?? 0} total`);
      qc.invalidateQueries({ queryKey: ["prospect_pool"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setRunning(false);
    }
  }

  async function runScore() {
    setScoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("score-prospects", {
        body: { audience_type: audience, limit: 200 },
      });
      if (error) throw error;
      toast.success(`Re-scored ${data?.scored ?? 0} prospects`);
      qc.invalidateQueries({ queryKey: ["prospect_pool"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setScoring(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Idle Pool Activator ── */}
      {idleStats && idleStats.total > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-amber-300 font-bold text-sm flex items-center gap-2">
                ⚠️ {idleStats.total} Idle Prospects Detected
              </h3>
              <p className="text-white/60 text-xs mt-1">
                {idleStats.missingEmail} missing emails · {idleStats.neverContacted} never contacted
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={runBackfill}
                disabled={backfilling}
                className="border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
              >
                {backfilling ? <Loader2 className="animate-spin" size={14} /> : "🔍"} Backfill Emails
              </Button>
              <Button
                size="sm"
                onClick={runActivate}
                disabled={activating}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {activating ? <Loader2 className="animate-spin" size={14} /> : "✉️"} Activate Drip
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {idleStats.top.map(([industry, stats]) => (
              <div key={industry} className="bg-black/20 rounded px-2 py-1.5 flex justify-between gap-2">
                <span className="text-white/80 truncate">{industry}</span>
                <span className="text-white/50 shrink-0">
                  {stats.total} <span className="text-emerald-400">({stats.hasEmail}✉)</span>
                </span>
              </div>
            ))}
          </div>
          <ProviderHealthRow />
          <p className="text-white/40 text-[11px]">
            Backfill walks site scrape → Snov → Apollo → pattern-verify → Hunter → PDL. Cheapest providers first; auto-skips any provider that 429&apos;d in the last hour.
          </p>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Search size={14} /> Targeting Engine
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-white/50 text-xs uppercase tracking-wide block mb-1">Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full bg-[#0a1628] border border-white/15 rounded px-2 py-2 text-white text-sm"
            >
              {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-white/50 text-xs uppercase tracking-wide block mb-1">County (optional)</label>
            <Input
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              placeholder="Wayne / Oakland / Macomb / Dallas / Maricopa…"
              className="bg-[#0a1628] border-white/15 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs uppercase tracking-wide block mb-1">Limit</label>
            <Input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 50)}
              className="bg-[#0a1628] border-white/15 text-white text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={runScrape} disabled={running} className="bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-[#0a1628]">
            {running ? <><Loader2 className="animate-spin mr-2" size={14} /> Scraping…</> : <>🚀 Run Scrape</>}
          </Button>
          <Button onClick={runScore} disabled={scoring} variant="outline" className="border-white/15 text-white hover:bg-white/10">
            {scoring ? <><Loader2 className="animate-spin mr-2" size={14} /> Scoring…</> : <>⚡ Re-score Pool</>}
          </Button>
        </div>

        <div className="text-white/40 text-xs">
          Sources used per audience: CMS (nursing/senior), NPI Registry (healthcare staffing), Sonar OSINT (trades/supply),
          LARA Accela (HVAC/plumbing/electrical), SAM.gov (industrial mfg).
        </div>
      </div>

      <AudienceSummary audience={audience} county={county} />
    </div>
  );
}

function AudienceSummary({ audience, county }: { audience: string; county: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["prospect_pool_summary", audience, county],
    queryFn: async () => {
      let q = supabase.from("prospect_pool").select("id, lead_score, email, fax_number, phone, address_line1", { count: "exact" }).eq("audience_type", audience);
      if (county) q = q.eq("county", county);
      const { data: rows, count } = await q.limit(500);
      const r = rows || [];
      return {
        total: count ?? r.length,
        with_email: r.filter((p) => !!p.email).length,
        with_fax: r.filter((p) => !!p.fax_number).length,
        with_phone: r.filter((p) => !!p.phone).length,
        with_address: r.filter((p) => !!p.address_line1).length,
        hot: r.filter((p) => (p.lead_score ?? 0) >= 70).length,
      };
    },
  });

  if (isLoading) return <div className="text-white/40 text-sm">Loading summary…</div>;
  if (!data) return null;

  const stats = [
    { label: "Total", value: data.total, color: "text-white" },
    { label: "Hot (70+)", value: data.hot, color: "text-[#00d4ff]" },
    { label: "📧 Email", value: data.with_email, color: "text-emerald-400" },
    { label: "📠 Fax", value: data.with_fax, color: "text-amber-400" },
    { label: "📞 Phone", value: data.with_phone, color: "text-blue-400" },
    { label: "📬 Mailable", value: data.with_address, color: "text-purple-400" },
  ];
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <div className={cn("text-2xl font-black", s.color)}>{s.value.toLocaleString()}</div>
          <div className="text-white/50 text-xs mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// SUB-TAB 2 — Ranked Pool
// ============================================================
function RankedPool() {
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [countyFilter, setCountyFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState<typeof CHANNELS[number]>("any");
  const [minScore, setMinScore] = useState(0);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasFax, setHasFax] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasAddress, setHasAddress] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["prospect_pool", audienceFilter, countyFilter, channelFilter, minScore, hasEmail, hasFax, hasPhone, hasAddress, search],
    queryFn: async () => {
      let q = supabase.from("prospect_pool").select("*").order("lead_score", { ascending: false }).limit(300);
      if (audienceFilter !== "all") q = q.eq("audience_type", audienceFilter);
      if (countyFilter) q = q.eq("county", countyFilter);
      if (channelFilter !== "any") q = q.eq("channel_hint", channelFilter);
      if (minScore > 0) q = q.gte("lead_score", minScore);
      if (hasEmail) q = q.not("email", "is", null);
      if (hasFax) q = q.not("fax_number", "is", null);
      if (hasPhone) q = q.not("phone", "is", null);
      if (hasAddress) q = q.not("address_line1", "is", null);
      if (search) q = q.ilike("business_name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Prospect[];
    },
  });

  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const qc = useQueryClient();

  // Coverage stats — counted client-side from currently loaded rows
  const coverage = (() => {
    const total = prospects.length || 1;
    const c = (fn: (p: Prospect) => boolean) => Math.round((prospects.filter(fn).length / total) * 100);
    return {
      email: c((p) => !!p.email),
      contact: c((p) => !!p.contact_name),
      reviews: c((p) => p.review_count != null && p.review_count > 0),
      carrier: c((p) => !!p.phone_carrier_type),
    };
  })();

  async function enrichOne(id: string) {
    setEnrichingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-prospect-pool", { body: { id } });
      if (error) throw error;
      const filled = data?.results?.[0]?.filled ?? [];
      toast.success(filled.length ? `Filled: ${filled.join(", ")}` : "No new data found");
      qc.invalidateQueries({ queryKey: ["prospect_pool"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enrichment failed");
    } finally {
      setEnrichingId(null);
    }
  }

  async function enrichAll() {
    setEnrichingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-prospect-pool", { body: { limit: 25 } });
      if (error) throw error;
      toast.success(`Enriched ${data?.enriched ?? 0} of ${data?.processed ?? 0} prospects`);
      qc.invalidateQueries({ queryKey: ["prospect_pool"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch enrichment failed");
    } finally {
      setEnrichingAll(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === prospects.length) setSelected(new Set());
    else setSelected(new Set(prospects.map((p) => p.id)));
  }

  function exportCSV() {
    const rows = prospects.filter((p) => selected.size === 0 || selected.has(p.id));
    const cols = ["business_name", "audience_type", "city", "state", "lead_score", "email", "phone", "fax_number", "address_line1", "website"];
    const csv = [
      cols.join(","),
      ...rows.map((r) => cols.map((c) => JSON.stringify((r as unknown as Record<string, unknown>)[c] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospects_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} prospects`);
  }

  async function bulkAction(channel: "email" | "postcard" | "fax" | "call" | "suppress") {
    const ids = Array.from(selected);
    if (ids.length === 0) return toast.error("Select prospects first");
    if (channel === "suppress") {
      const { error } = await supabase.from("prospect_pool").update({ status: "suppressed" }).in("id", ids);
      if (error) return toast.error(error.message);
      toast.success(`Suppressed ${ids.length}`);
      setSelected(new Set());
      return;
    }
    const statusMap = { email: "queued_email", postcard: "queued_postcard", fax: "queued_fax", call: "queued_call" } as const;
    const { error } = await supabase.from("prospect_pool").update({ status: statusMap[channel] }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Queued ${ids.length} for ${channel} campaign — visit Active Campaigns to send`);
    setSelected(new Set());
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-3">
      {/* Coverage strip + Enrich All */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="text-white/60 text-xs uppercase tracking-wide font-semibold mr-2">Coverage</div>
        {[
          { k: "Email", v: coverage.email, c: "text-emerald-400" },
          { k: "Contact", v: coverage.contact, c: "text-blue-400" },
          { k: "Reviews", v: coverage.reviews, c: "text-amber-400" },
          { k: "Carrier", v: coverage.carrier, c: "text-purple-400" },
        ].map((s) => (
          <div key={s.k} className="text-xs">
            <span className="text-white/50">{s.k}:</span>{" "}
            <span className={cn("font-bold", s.c)}>{s.v}%</span>
          </div>
        ))}
        <div className="ml-auto">
          <Button size="sm" onClick={enrichAll} disabled={enrichingAll} className="bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-[#0a1628]">
            {enrichingAll ? <Loader2 className="animate-spin mr-1" size={12} /> : <Sparkles size={12} className="mr-1" />}
            Enrich All (25)
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">

        <select value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value)} className="bg-[#0a1628] border border-white/15 rounded px-2 py-1.5 text-white">
          <option value="all">All audiences</option>
          {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <Input value={countyFilter} onChange={(e) => setCountyFilter(e.target.value)} placeholder="County" className="bg-[#0a1628] border-white/15 text-white text-xs h-8" />
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as typeof CHANNELS[number])} className="bg-[#0a1628] border border-white/15 rounded px-2 py-1.5 text-white">
          {CHANNELS.map((c) => <option key={c} value={c}>{c === "any" ? "Any channel hint" : c}</option>)}
        </select>
        <Input type="number" value={minScore} onChange={(e) => setMinScore(Number(e.target.value) || 0)} placeholder="Min score" className="bg-[#0a1628] border-white/15 text-white text-xs h-8" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 business name…" className="bg-[#0a1628] border-white/15 text-white text-xs h-8 col-span-2" />
        <label className="flex items-center gap-2 text-white/70"><Checkbox checked={hasEmail} onCheckedChange={(v) => setHasEmail(!!v)} /> Has email</label>
        <label className="flex items-center gap-2 text-white/70"><Checkbox checked={hasFax} onCheckedChange={(v) => setHasFax(!!v)} /> Has fax</label>
        <label className="flex items-center gap-2 text-white/70"><Checkbox checked={hasPhone} onCheckedChange={(v) => setHasPhone(!!v)} /> Has phone</label>
        <label className="flex items-center gap-2 text-white/70"><Checkbox checked={hasAddress} onCheckedChange={(v) => setHasAddress(!!v)} /> Mailable</label>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-lg p-3 flex flex-wrap gap-2 items-center sticky top-0 z-10">
          <span className="text-[#00d4ff] font-bold text-sm mr-2">{selected.size} selected →</span>
          <Button size="sm" onClick={() => bulkAction("email")} className="bg-emerald-600 hover:bg-emerald-700"><Mail size={12} className="mr-1" /> Email Campaign</Button>
          <Button size="sm" onClick={() => bulkAction("postcard")} className="bg-purple-600 hover:bg-purple-700"><Printer size={12} className="mr-1" /> Postcard</Button>
          <Button size="sm" onClick={() => bulkAction("fax")} className="bg-amber-600 hover:bg-amber-700"><MessageSquare size={12} className="mr-1" /> Fax</Button>
          <Button size="sm" onClick={() => bulkAction("call")} className="bg-blue-600 hover:bg-blue-700"><Phone size={12} className="mr-1" /> Call Sheet</Button>
          <Button size="sm" variant="outline" onClick={() => bulkAction("suppress")} className="border-red-500/50 text-red-400 hover:bg-red-500/10"><Shield size={12} className="mr-1" /> Suppress</Button>
          <Button size="sm" variant="outline" onClick={exportCSV} className="border-white/20 text-white"><Download size={12} className="mr-1" /> Export CSV</Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between text-xs">
          <span className="text-white/60">{isLoading ? "Loading…" : `${prospects.length} prospects`}</span>
          <Button size="sm" variant="ghost" onClick={exportCSV} className="text-white/60 h-7"><Download size={12} className="mr-1" /> Export all</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/5">
              <tr className="text-white/50 text-left">
                <th className="p-2"><Checkbox checked={selected.size === prospects.length && prospects.length > 0} onCheckedChange={toggleAll} /></th>
                <th className="p-2">Business</th>
                <th className="p-2">Audience</th>
                <th className="p-2">City</th>
                <th className="p-2 text-right">Score</th>
                <th className="p-2">Channels</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Sends</th>
                <th className="p-2 text-right">Enrich</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => {
                const trace = getTrace(p);
                const sourceFor = (field: string) => trace.find((t) => t.ok && t.filled?.includes(field))?.source;
                const badge = (filled: boolean, field: string, cls: string, icon: string) => {
                  if (!filled) return null;
                  const src = sourceFor(field);
                  const el = <Badge variant="outline" className={cn("text-[10px] cursor-help", cls)}>{icon}</Badge>;
                  return src ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{el}</TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">via {src}</TooltipContent>
                    </Tooltip>
                  ) : el;
                };
                return (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="p-2"><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} /></td>
                  <td className="p-2 text-white font-medium">
                    {p.business_name}
                    {p.contact_name && (
                      sourceFor("contact_name") ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-white/40 text-[10px] cursor-help">{p.contact_name}</div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">via {sourceFor("contact_name")}</TooltipContent>
                        </Tooltip>
                      ) : <div className="text-white/40 text-[10px]">{p.contact_name}</div>
                    )}
                  </td>
                  <td className="p-2 text-white/70">{p.audience_type}</td>
                  <td className="p-2 text-white/70">{p.city ?? "—"}{p.state ? `, ${p.state}` : ""}</td>
                  <td className="p-2 text-right">
                    <span className={cn(
                      "font-bold",
                      p.lead_score >= 70 ? "text-[#00d4ff]" :
                      p.lead_score >= 40 ? "text-emerald-400" :
                      p.lead_score >= 20 ? "text-amber-400" : "text-white/40"
                    )}>{p.lead_score}</span>
                  </td>
                  <td className="p-2 space-x-1">
                    {badge(!!p.email, "email", "border-emerald-500/40 text-emerald-400", "📧")}
                    {badge(!!p.fax_number, "fax_number", "border-amber-500/40 text-amber-400", "📠")}
                    {badge(!!p.phone, "phone", "border-blue-500/40 text-blue-400", "📞")}
                    {badge(!!p.address_line1, "address_line1", "border-purple-500/40 text-purple-400", "📬")}
                    {p.review_count != null && p.review_count > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[10px] cursor-help border-yellow-500/40 text-yellow-400">⭐{p.google_rating ?? "?"}</Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">{p.review_count} reviews via Google Places</TooltipContent>
                      </Tooltip>
                    )}
                    {p.phone_carrier_type && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[10px] cursor-help border-cyan-500/40 text-cyan-400">{p.phone_carrier_type === "mobile" ? "📱" : "☎️"}</Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">{p.phone_carrier_type} via Twilio Lookup</TooltipContent>
                      </Tooltip>
                    )}
                  </td>
                  <td className="p-2 text-white/60">
                    {p.status}
                    {p.enrichment_status && (
                      <div className="text-white/30 text-[10px]">{p.enrichment_status}</div>
                    )}
                  </td>
                  <td className="p-2 text-right text-white/50">{p.send_count}</td>
                  <td className="p-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => enrichOne(p.id)}
                      disabled={enrichingId === p.id}
                      className="h-7 px-2 text-[10px] text-[#00d4ff] hover:bg-[#00d4ff]/10"
                      title={trace.length ? `Last enriched: ${trace.filter(t=>t.ok).map(t=>t.source).join(", ")}` : "Run enrichment waterfall"}
                    >
                      {enrichingId === p.id ? <Loader2 className="animate-spin" size={12} /> : <>🔄 {trace.length ? "Re-enrich" : "Enrich"}</>}
                    </Button>
                  </td>
                </tr>
                );
              })}
              {!isLoading && prospects.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-white/40">No prospects match these filters. Run a scrape from the Find tab.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

// ============================================================
// SUB-TAB 3 — Active Campaigns (unified)
// ============================================================
function ActiveCampaigns() {
  const { data: postcards = [] } = useQuery({
    queryKey: ["postcard_campaigns_active"],
    queryFn: async () => {
      const { data } = await supabase.from("postcard_campaigns").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const { data: faxes = [] } = useQuery({
    queryKey: ["fax_campaigns_active"],
    queryFn: async () => {
      const { data } = await supabase.from("fax_campaigns").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const { data: emails = [] } = useQuery({
    queryKey: ["email_send_log_recent"],
    queryFn: async () => {
      const { data } = await supabase.from("email_send_log").select("id, recipient_email, template_name, status, created_at").order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });
  const { data: sms = [] } = useQuery({
    queryKey: ["sms_recent"],
    queryFn: async () => {
      const { data } = await supabase.from("system_comms_log").select("id, recipient, body_preview, status, created_at, product").eq("channel", "sms").order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CampaignCard title="📬 Postcard Campaigns" badge="postcard" rows={postcards.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        primary: (c.campaign_name ?? c.audience_type ?? "—") as string,
        secondary: (c.status ?? "—") as string,
        meta: `${c.total_sent ?? 0} sent`,
        date: c.created_at as string,
      }))} />
      <CampaignCard title="📠 Fax Campaigns" badge="fax" rows={faxes.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        primary: (c.campaign_name ?? c.audience_type ?? "—") as string,
        secondary: (c.status ?? "—") as string,
        meta: `${c.total_sent ?? 0} sent`,
        date: c.created_at as string,
      }))} />
      <CampaignCard title="📧 Recent Emails" badge="email" rows={(emails as unknown as Record<string, unknown>[]).map((e) => ({
        id: e.id as string,
        primary: (e.template_name ?? "—") as string,
        secondary: (e.recipient_email ?? "—") as string,
        meta: (e.status ?? "—") as string,
        date: e.created_at as string,
      }))} />
      <CampaignCard title="💬 Recent SMS" badge="sms" rows={(sms as unknown as Record<string, unknown>[]).map((s) => ({
        id: s.id as string,
        primary: ((s.body_preview as string)?.slice(0, 60) ?? "—") as string,
        secondary: (s.recipient ?? "—") as string,
        meta: (s.status ?? "—") as string,
        date: s.created_at as string,
      }))} />
    </div>
  );
}

function CampaignCard({ title, badge, rows }: { title: string; badge: string; rows: { id: string; primary: string; secondary: string; meta: string; date: string }[] }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-white font-bold text-sm">{title}</h3>
        <Badge variant="outline" className="text-[10px] border-[#00d4ff]/40 text-[#00d4ff]">{badge}</Badge>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-white/40 text-xs">No recent activity</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="p-3 hover:bg-white/5 text-xs">
              <div className="text-white font-medium truncate">{r.primary}</div>
              <div className="text-white/50 truncate">{r.secondary}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-white/40">{r.meta}</span>
                <span className="text-white/30">{r.date ? new Date(r.date).toLocaleString() : ""}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUB-TAB 4 — Compliance & Suppression
// ============================================================
function Compliance() {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["compliance_stats"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("compliance-stats");
      return data as { sms_sent_7d: number; opt_outs_7d: number; opt_outs_total: number; blocks_7d_total: number; blocks_by_reason: Record<string, number> } | null;
    },
  });

  const { data: smsOpts = [] } = useQuery({
    queryKey: ["sms_opt_outs_recent"],
    queryFn: async () => (await supabase.from("sms_opt_outs").select("phone, opted_out_at, source").order("opted_out_at", { ascending: false }).limit(20)).data ?? [],
  });
  const { data: emailSupps = [] } = useQuery({
    queryKey: ["suppressed_emails_recent"],
    queryFn: async () => (await supabase.from("suppressed_emails").select("email, reason, created_at").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const { data: faxOpts = [] } = useQuery({
    queryKey: ["fax_opt_outs_recent"],
    queryFn: async () => (await supabase.from("fax_opt_outs").select("fax_number, opted_out_at").order("opted_out_at", { ascending: false }).limit(20)).data ?? [],
  });

  const addPhone = useMutation({
    mutationFn: async (p: string) => {
      const norm = p.replace(/\D/g, "");
      const e164 = norm.length === 10 ? `+1${norm}` : norm.length === 11 ? `+${norm}` : p;
      const { error } = await supabase.from("sms_opt_outs").insert({ phone: e164, source: "manual_admin" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to SMS blocklist");
      setPhone("");
      qc.invalidateQueries({ queryKey: ["sms_opt_outs_recent"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addEmail = useMutation({
    mutationFn: async (em: string) => {
      const { error } = await supabase.from("suppressed_emails").insert({ email: em.toLowerCase().trim(), reason: "manual_admin" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to email blocklist");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["suppressed_emails_recent"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "SMS sent (7d)", value: stats?.sms_sent_7d ?? "—", color: "text-blue-400" },
          { label: "Opt-outs (7d)", value: stats?.opt_outs_7d ?? "—", color: "text-amber-400" },
          { label: "Opt-outs total", value: stats?.opt_outs_total ?? "—", color: "text-white" },
          { label: "Blocks (7d)", value: stats?.blocks_7d_total ?? "—", color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
            <div className={cn("text-2xl font-black", s.color)}>{s.value}</div>
            <div className="text-white/50 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick add */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex gap-2">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="📞 Phone to block" className="bg-[#0a1628] border-white/15 text-white text-xs" />
          <Button size="sm" onClick={() => addPhone.mutate(phone)} disabled={!phone || addPhone.isPending} className="bg-red-600 hover:bg-red-700">Block</Button>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="📧 Email to suppress" className="bg-[#0a1628] border-white/15 text-white text-xs" />
          <Button size="sm" onClick={() => addEmail.mutate(email)} disabled={!email || addEmail.isPending} className="bg-red-600 hover:bg-red-700">Suppress</Button>
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BlockList title="📵 SMS Opt-outs" rows={smsOpts.map((r: Record<string, unknown>) => ({ primary: (r.phone ?? "") as string, secondary: (r.source ?? "") as string, date: r.opted_out_at as string }))} />
        <BlockList title="📧 Email Suppressions" rows={emailSupps.map((r: Record<string, unknown>) => ({ primary: (r.email ?? "") as string, secondary: (r.reason ?? "") as string, date: r.created_at as string }))} />
        <BlockList title="📠 Fax Opt-outs" rows={faxOpts.map((r: Record<string, unknown>) => ({ primary: (r.fax_number ?? "") as string, secondary: "fax", date: r.opted_out_at as string }))} />
      </div>
    </div>
  );
}

function BlockList({ title, rows }: { title: string; rows: { primary: string; secondary: string; date: string }[] }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-white/10 text-white font-bold text-sm">{title}</div>
      <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
        {rows.length === 0 ? (
          <div className="p-4 text-center text-white/40 text-xs">None recent</div>
        ) : rows.map((r, i) => (
          <div key={i} className="p-2 text-xs">
            <div className="text-white truncate">{r.primary}</div>
            <div className="flex items-center justify-between text-white/40">
              <span>{r.secondary}</span>
              <span>{r.date ? new Date(r.date).toLocaleDateString() : ""}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
