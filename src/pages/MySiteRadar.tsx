import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Check, Sparkles, Download, ArrowUpRight, X, Loader2,
  Flame, TrendingUp, Building2, MapPin, Clock, Eye, Mail, Phone,
  Globe, AlertCircle, Zap, Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import ManageBillingButton from "@/components/billing/ManageBillingButton";
import OnboardingChecklist from "@/components/shared/OnboardingChecklist";

import AlertWebhookConfig from "@/components/site-radar/AlertWebhookConfig";
import InstallConcierge from "@/components/site-radar/InstallConcierge";
import SelfInstallGuide from "@/components/site-radar/SelfInstallGuide";
import JustPurchasedScreen, { isJustPurchased } from "@/components/shared/JustPurchasedScreen";

type Client = {
  id: string;
  business_name: string;
  email: string;
  visitor_script_key: string | null;
};

type Event = {
  id: string;
  client_id: string;
  page_visited: string | null;
  company_name: string | null;
  city: string | null;
  created_at: string;
  enrichment_data?: Record<string, unknown> | null;
};

// ───────────────────────────────────────────────────────────────
// Intent scoring + signal triggers — what makes this premium.
// ───────────────────────────────────────────────────────────────

function computeIntentScore(events: Event[], companyName: string): number {
  const ces = events.filter((e) => e.company_name === companyName);
  if (ces.length === 0) return 0;
  const visits = ces.length;
  const pages = new Set(ces.map((e) => e.page_visited).filter(Boolean)).size;
  const hitPricing = ces.some((e) => /pricing|plans|cost/i.test(e.page_visited || ""));
  const hitContact = ces.some((e) => /contact|demo|consult|quote/i.test(e.page_visited || ""));
  const hitSpecs = ces.some((e) => /spec|case-study|enterprise|api|features/i.test(e.page_visited || ""));
  const dayCount = new Set(ces.map((e) => new Date(e.created_at).toDateString())).size;

  let score = 0;
  score += Math.min(visits * 6, 30);
  score += Math.min(pages * 4, 20);
  if (hitPricing) score += 18;
  if (hitContact) score += 18;
  if (hitSpecs) score += 8;
  if (dayCount >= 2) score += 10;
  if (dayCount >= 4) score += 6;
  return Math.min(100, score);
}

type Signal = { icon: string; label: string; tone: "fire" | "warm" | "cold" | "blue" };
function getSignals(events: Event[], companyName: string): Signal[] {
  const ces = events.filter((e) => e.company_name === companyName);
  const signals: Signal[] = [];
  const hitPricing = ces.some((e) => /pricing|plans|cost/i.test(e.page_visited || ""));
  const hitContact = ces.some((e) => /contact|demo|consult|quote/i.test(e.page_visited || ""));
  const dayCount = new Set(ces.map((e) => new Date(e.created_at).toDateString())).size;

  if (hitPricing && hitContact) signals.push({ icon: "🔥", label: "Closing window", tone: "fire" });
  else if (hitPricing) signals.push({ icon: "💰", label: "Pricing intent", tone: "warm" });
  if (dayCount >= 3) signals.push({ icon: "🌡️", label: "Returning warm", tone: "warm" });
  if (ces.length >= 5) signals.push({ icon: "👀", label: "Deep researcher", tone: "blue" });
  // After-hours visit
  const afterHours = ces.some((e) => {
    const h = new Date(e.created_at).getHours();
    return h < 8 || h > 18;
  });
  if (afterHours) signals.push({ icon: "🌙", label: "After-hours research", tone: "blue" });
  return signals;
}

function tierFromScore(score: number): { label: string; color: string; ring: string } {
  if (score >= 70) return { label: "HOT", color: "text-red-500", ring: "ring-red-500/40 bg-red-500/10" };
  if (score >= 40) return { label: "WARM", color: "text-amber-500", ring: "ring-amber-500/40 bg-amber-500/10" };
  if (score >= 15) return { label: "INTERESTED", color: "text-cyan-400", ring: "ring-cyan-400/40 bg-cyan-400/10" };
  return { label: "BROWSING", color: "text-slate-400", ring: "ring-slate-500/30 bg-slate-500/10" };
}

export default function MySiteRadar() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [client, setClient] = useState<Client | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [icpKeywords, setIcpKeywords] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("siteradar_icp_keywords_v1") || "";
  });
  const [icpDraft, setIcpDraft] = useState("");
  const [icpEditing, setIcpEditing] = useState(false);
  const saveIcp = (v: string) => {
    setIcpKeywords(v);
    localStorage.setItem("siteradar_icp_keywords_v1", v);
    setIcpEditing(false);
  };
  const icpTokens = useMemo(
    () => icpKeywords.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    [icpKeywords],
  );
  const isIcpMatch = useCallback(
    (e: { company_name?: string | null; city?: string | null; page_visited?: string | null }) => {
      if (icpTokens.length === 0) return false;
      const haystack = `${e.company_name || ""} ${e.city || ""} ${e.page_visited || ""}`.toLowerCase();
      return icpTokens.some((t) => haystack.includes(t));
    },
    [icpTokens],
  );
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  useEffect(() => {
    // Defensive: ensure tab title doesn't get clobbered by M² helmets during nav.
    document.title = "SiteRadar — Detroit Web Agency";
  }, []);

  useEffect(() => {
    if (!token) { setError("Missing access token. Use the link from your welcome email."); setLoading(false); return; }
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: c, error: ce } = await supabase
        .from("field_crm_clients")
        .select("id,business_name,email,visitor_script_key")
        .eq("dispatch_token", token)
        .maybeSingle();
      if (ce || !c) { setError("Invalid or expired link."); setLoading(false); return; }
      setClient(c as Client);
      const { data: ev } = await supabase
        .from("crm_visitor_events")
        .select("id,client_id,page_visited,company_name,city,created_at,enrichment_data")
        .eq("client_id", c.id)
        .order("created_at", { ascending: false })
        .limit(200);
      setEvents((ev || []) as Event[]);
      setLoading(false);
      channel = supabase
        .channel(`siteradar-${c.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "crm_visitor_events", filter: `client_id=eq.${c.id}` }, (payload) => {
          setEvents((prev) => [payload.new as Event, ...prev].slice(0, 200));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "crm_visitor_events", filter: `client_id=eq.${c.id}` }, (payload) => {
          setEvents((prev) => prev.map((e) => e.id === (payload.new as Event).id ? (payload.new as Event) : e));
        })
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [token]);

  const todayCount = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return events.filter((e) => new Date(e.created_at) >= start).length;
  }, [events]);

  const businessesIdentified = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Set(events.filter((e) => e.company_name && new Date(e.created_at) >= today).map((e) => e.company_name)).size;
  }, [events]);

  const icpMatchCount = useMemo(() => events.filter(isIcpMatch).length, [events, isIcpMatch]);

  const topCompanies = useMemo(() => {
    const map = new Map<string, { name: string; city: string | null; count: number; score: number; signals: Signal[] }>();
    for (const e of events) {
      if (!e.company_name) continue;
      if (!map.has(e.company_name)) {
        map.set(e.company_name, {
          name: e.company_name,
          city: e.city,
          count: 0,
          score: computeIntentScore(events, e.company_name),
          signals: getSignals(events, e.company_name),
        });
      }
      const cur = map.get(e.company_name)!;
      cur.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.score - a.score).slice(0, 8);
  }, [events]);

  const hottestVisitor = topCompanies[0] || null;

  const lastEvent = events[0];
  const healthy = lastEvent && Date.now() - new Date(lastEvent.created_at).getTime() < 1000 * 60 * 60 * 24;

  const snippet = client?.visitor_script_key
    ? `<script async src="${import.meta.env.VITE_SUPABASE_URL}/functions/v1/visitor-identify?key=${client.visitor_script_key}"></script>`
    : "";

  const enrich = useCallback(async (eventId: string) => {
    setEnrichingIds((p) => new Set(p).add(eventId));
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("enrich-visitor", {
        body: { visitor_event_id: eventId },
      });
      if (invokeErr) throw invokeErr;
      const result = data as { success?: boolean; reason?: string; message?: string; company_name?: string };
      if (result?.success === false) {
        if (result.reason === "residential_isp") {
          toast.warning("Residential ISP — no company to identify", { description: result.message });
        } else if (result.reason === "no_company") {
          toast.warning("No match found", { description: "We couldn't reverse-resolve a company for this visitor." });
        } else {
          toast.error("Enrichment failed", { description: result.message || "Unknown error" });
        }
      } else {
        toast.success(`Identified: ${result?.company_name ?? "company"}`, { description: "Visitor row updated." });
      }
    } catch (e) {
      toast.error("Enrichment error", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setEnrichingIds((p) => { const n = new Set(p); n.delete(eventId); return n; });
    }
  }, []);

  const bulkEnrich = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.info("Select visitor rows first");
      return;
    }
    setBulkEnriching(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        const { data } = await supabase.functions.invoke("enrich-visitor", { body: { visitor_event_id: id } });
        const r = data as { success?: boolean };
        if (r?.success) ok++; else fail++;
      } catch { fail++; }
    }
    setBulkEnriching(false);
    setSelected(new Set());
    toast.success(`Enriched ${ok}`, { description: fail ? `${fail} could not be matched.` : undefined });
  }, [selected]);

  const toggleSelect = (id: string) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Snippet copied");
    setTimeout(() => setCopied(false), 1800);
  };

  const csvEscape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleExport = async () => {
    if (!client) return;
    setExporting(true);
    try {
      const fromIso = new Date(exportFrom); fromIso.setHours(0, 0, 0, 0);
      const toIso = new Date(exportTo); toIso.setHours(23, 59, 59, 999);
      const { data, error: qErr } = await supabase
        .from("crm_visitor_events")
        .select("created_at, company_name, city, region, country, page_visited, referrer, ip_address, is_business, visit_count")
        .eq("client_id", client.id)
        .gte("created_at", fromIso.toISOString())
        .lte("created_at", toIso.toISOString())
        .order("created_at", { ascending: false })
        .limit(10000);
      if (qErr) throw qErr;
      const rows = data || [];
      if (rows.length === 0) { toast.info("No events in range"); return; }
      const header = ["created_at", "company_name", "city", "region", "country", "page_visited", "referrer", "ip_address", "is_business", "visit_count"];
      const lines = [header.join(",")];
      rows.forEach((r: Record<string, unknown>) => {
        lines.push(header.map((k) => csvEscape(r[k])).join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `siteradar-events-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} rows`);
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setExporting(false);
    }
  };

  const companyDetail = useMemo(() => {
    if (!selectedCompany) return null;
    const ces = events.filter((e) => e.company_name === selectedCompany);
    const pages = [...new Set(ces.map((e) => e.page_visited).filter(Boolean))] as string[];
    return {
      name: selectedCompany,
      city: ces[0]?.city ?? null,
      pages,
      visitCount: ces.length,
      firstSeen: ces[ces.length - 1]?.created_at ?? null,
      lastSeen: ces[0]?.created_at ?? null,
      icpMatch: ces.some(isIcpMatch),
      score: computeIntentScore(events, selectedCompany),
      signals: getSignals(events, selectedCompany),
      latestEventId: ces[0]?.id ?? null,
      enrichment: ces.find((e) => e.enrichment_data)?.enrichment_data as
        | { owner_name?: string; owner_email?: string; owner_phone?: string; website?: string }
        | undefined,
    };
  }, [selectedCompany, events, isIcpMatch]);

  if (!loading && error && isJustPurchased()) return <JustPurchasedScreen product="SiteRadar" />;

  return (
    <TooltipProvider delayDuration={150}>
      <Helmet>
        <title>SiteRadar — Your Dashboard | Detroit Web Agency</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-[#030711] via-[#050d20] to-[#030711] text-foreground">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-400">
                📡 SiteRadar
              </p>
              <h1 className="text-2xl font-bold text-white md:text-3xl">Who's visiting your site</h1>
              <p className="mt-1 text-sm text-slate-400">{client?.business_name ?? "Loading…"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={healthy ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-red-500/40 bg-red-500/10 text-red-400"}>
                <span className={`mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full ${healthy ? "bg-emerald-400" : "bg-red-400"}`} />
                {healthy ? "Live" : "No data 24h"}
              </Badge>
            </div>
          </div>

          {loading && <p className="text-slate-400">Loading…</p>}

          {error && (
            <Card className="border-red-500/40 bg-red-500/5 p-6">
              <p className="text-red-400">{error}</p>
            </Card>
          )}

          {client && (
            <div className="space-y-5">
              {/* Hot Visitor Hero */}
              {hottestVisitor && hottestVisitor.score >= 15 && (
                <HotVisitorHero
                  visitor={hottestVisitor}
                  onOpen={() => setSelectedCompany(hottestVisitor.name)}
                  onEnrich={() => {
                    const ev = events.find((e) => e.company_name === hottestVisitor.name);
                    if (ev) enrich(ev.id);
                  }}
                />
              )}

              <OnboardingChecklist
                product="SiteRadar"
                steps={[
                  { id: "auth", label: "Dashboard link verified", done: !!client, hint: "Open from your welcome email." },
                  { id: "snippet", label: "Tracking snippet installed", done: !!client?.visitor_script_key, hint: "Paste the script tag into your site." },
                  { id: "events", label: "First visitor tracked", done: events.length > 0, hint: "Visit your own site to test." },
                  { id: "company", label: "First business identified", done: businessesIdentified > 0, hint: "Company-level reveal happens automatically." },
                ]}
              />

              {/* Stat strip */}
              <div className="grid grid-cols-3 gap-3">
                <Stat icon={<Eye className="h-4 w-4" />} label="Today's visitors" value={todayCount} />
                <Stat icon={<Building2 className="h-4 w-4" />} label="Identified" value={businessesIdentified} />
                <Stat icon={<Target className="h-4 w-4" />} label="ICP matches" value={icpMatchCount} accent />
              </div>

              {/* Top companies leaderboard */}
              <Card className="border-cyan-900/40 bg-[#0a1628]/80 p-5 backdrop-blur">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    🏆 Top intent visitors
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">Sorted by intent score</span>
                </div>
                {topCompanies.length === 0 ? (
                  <p className="text-sm text-slate-500">No identified businesses yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topCompanies.map((c) => (
                      <CompanyRow
                        key={c.name}
                        c={c}
                        onClick={() => setSelectedCompany(c.name)}
                      />
                    ))}
                  </div>
                )}
              </Card>

              {/* ICP Filter */}
              <Card className="border-cyan-900/40 bg-[#0a1628]/80 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      🎯 ICP filter
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Match visitors against your ideal customer profile. Comma-separated keywords.
                    </p>
                  </div>
                  {icpKeywords && !icpEditing && (
                    <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20">
                      {icpMatchCount} matches
                    </Badge>
                  )}
                </div>
                {icpEditing ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Input
                      autoFocus
                      value={icpDraft}
                      onChange={(e) => setIcpDraft(e.target.value)}
                      placeholder="hvac, manufacturing, troy, /pricing"
                      className="flex-1 min-w-[220px] border-slate-700 bg-[#030711] text-slate-200"
                    />
                    <Button size="sm" onClick={() => saveIcp(icpDraft)} className="bg-cyan-400 text-slate-900 hover:bg-cyan-300">Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setIcpEditing(false)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {icpTokens.length === 0 ? (
                      <span className="text-xs italic text-slate-500">No ICP set — visitors won't be flagged.</span>
                    ) : (
                      icpTokens.map((t) => (
                        <Badge key={t} variant="outline" className="border-cyan-700/40 bg-cyan-500/10 text-cyan-400">{t}</Badge>
                      ))
                    )}
                    <Button
                      size="sm" variant="outline"
                      onClick={() => { setIcpDraft(icpKeywords); setIcpEditing(true); }}
                      className="ml-auto border-slate-700 text-cyan-400 hover:bg-cyan-500/10"
                    >
                      {icpKeywords ? "Edit" : "Set ICP"}
                    </Button>
                  </div>
                )}
              </Card>

              {/* Live feed with bulk enrich */}
              <Card className="border-cyan-900/40 bg-[#0a1628]/80 p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    📡 Live visitor feed
                  </p>
                  <div className="flex items-center gap-2">
                    {selected.size > 0 && (
                      <Button
                        size="sm"
                        onClick={bulkEnrich}
                        disabled={bulkEnriching}
                        className="bg-cyan-400 text-slate-900 hover:bg-cyan-300"
                      >
                        {bulkEnriching ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                        Enrich {selected.size}
                      </Button>
                    )}
                  </div>
                </div>
                {events.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Waiting for visitors…</p>
                ) : (
                  <ul className="max-h-[440px] space-y-1 overflow-y-auto">
                    <AnimatePresence initial={false}>
                      {events.map((e) => {
                        const match = isIcpMatch(e);
                        const enriching = enrichingIds.has(e.id);
                        const sel = selected.has(e.id);
                        const enrichOutcome = (e.enrichment_data as { outcome?: string } | null)?.outcome;
                        return (
                          <motion.li
                            key={e.id}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`flex items-center gap-3 rounded-md border-l-2 px-2 py-2.5 transition ${
                              match ? "border-emerald-400 bg-emerald-500/5" : "border-transparent hover:bg-white/[0.02]"
                            }`}
                          >
                            {!e.company_name && (
                              <Checkbox
                                checked={sel}
                                onCheckedChange={() => toggleSelect(e.id)}
                                className="border-slate-600"
                              />
                            )}
                            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${e.company_name ? "bg-emerald-400" : "bg-slate-600"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-slate-200">
                                {e.page_visited || "—"}
                                {match && (
                                  <Badge className="ml-2 bg-emerald-500/15 px-1.5 py-0 text-[9px] text-emerald-400">ICP</Badge>
                                )}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {e.company_name ? (
                                  <button
                                    onClick={() => setSelectedCompany(e.company_name!)}
                                    className="text-cyan-400 underline decoration-dotted hover:text-cyan-300"
                                  >
                                    {e.company_name}
                                  </button>
                                ) : (
                                  "Unknown visitor"
                                )} · {new Date(e.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                            {!e.company_name && (
                              enrichOutcome === "residential_isp" ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="border-slate-700 text-slate-500">
                                      <AlertCircle className="mr-1 h-3 w-3" /> Residential
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs text-xs">
                                      Came from a residential or mobile ISP. No company can be identified —
                                      common for personal devices.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={enriching}
                                  onClick={() => enrich(e.id)}
                                  className="h-7 border-cyan-700/40 text-cyan-400 hover:bg-cyan-500/10"
                                >
                                  {enriching ? (
                                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Enriching…</>
                                  ) : (
                                    <><Sparkles className="mr-1 h-3 w-3" /> Enrich</>
                                  )}
                                </Button>
                              )
                            )}
                            {e.company_name && (
                              <Badge variant="outline" className="border-emerald-700/40 bg-emerald-500/10 text-emerald-400">
                                <Check className="mr-1 h-3 w-3" /> Identified
                              </Badge>
                            )}
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </Card>

              {/* Snippet (collapsed footer-style — install concierge teaser) */}
              <Card className="border-cyan-900/40 bg-gradient-to-br from-[#0a1628] to-[#0d2547] p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">⚙️ Tracking snippet</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Paste before <code className="text-cyan-400">&lt;/body&gt;</code>. Or reply to your welcome email — we'll install it for you.
                    </p>
                  </div>
                  <Button onClick={copySnippet} size="sm" className="bg-cyan-400 text-slate-900 hover:bg-cyan-300">
                    {copied ? <><Check className="mr-1 h-3 w-3" /> Copied</> : <><Copy className="mr-1 h-3 w-3" /> Copy</>}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-md bg-[#030711] p-3 text-[11px] text-slate-400">{snippet}</pre>
              </Card>

              {/* Export */}
              <Card className="border-cyan-900/40 bg-[#0a1628]/80 p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">📥 Export events</p>
                <p className="mt-1 mb-3 text-xs text-slate-500">Download a CSV of all visitor events in the date range.</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400">From</span>
                    <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="border-slate-700 bg-[#030711] text-slate-200" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400">To</span>
                    <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="border-slate-700 bg-[#030711] text-slate-200" />
                  </label>
                  <Button onClick={handleExport} disabled={exporting} className="bg-cyan-400 text-slate-900 hover:bg-cyan-300">
                    <Download className="mr-1 h-4 w-4" />
                    {exporting ? "Exporting…" : "Export CSV"}
                  </Button>
                </div>
              </Card>

              <InstallConcierge clientId={client.id} />

              <AlertWebhookConfig clientId={client.id} />

              <div className="pt-2">
                <ManageBillingButton email={client.email} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Company detail sheet */}
      <Sheet open={!!companyDetail} onOpenChange={(o) => !o && setSelectedCompany(null)}>
        <SheetContent className="w-full overflow-y-auto border-cyan-900/40 bg-[#0a1628] text-slate-200 sm:max-w-md">
          {companyDetail && (
            <>
              <SheetHeader>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-cyan-400">Company profile</p>
                <SheetTitle className="text-xl text-white">{companyDetail.name}</SheetTitle>
                {companyDetail.city && (
                  <p className="text-sm text-slate-400">
                    <MapPin className="mr-1 inline h-3 w-3" />
                    {companyDetail.city}
                  </p>
                )}
              </SheetHeader>

              <div className="mt-5 space-y-5">
                <div className="flex items-center gap-3">
                  <ScoreBadge score={companyDetail.score} />
                  {companyDetail.icpMatch && (
                    <Badge className="bg-emerald-500/15 text-emerald-400">✓ ICP Match</Badge>
                  )}
                </div>

                {companyDetail.signals.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {companyDetail.signals.map((s) => (
                      <Badge key={s.label} variant="outline" className="border-cyan-700/40 bg-cyan-500/10 text-cyan-300">
                        <span className="mr-1">{s.icon}</span>{s.label}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-slate-800 bg-[#030711] p-4">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Total visits</p>
                    <p className="mt-1 text-3xl font-extrabold text-cyan-400">{companyDetail.visitCount}</p>
                  </Card>
                  <Card className="border-slate-800 bg-[#030711] p-4">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Pages</p>
                    <p className="mt-1 text-3xl font-extrabold text-white">{companyDetail.pages.length}</p>
                  </Card>
                </div>

                {companyDetail.enrichment && (companyDetail.enrichment.owner_email || companyDetail.enrichment.owner_phone) && (
                  <Card className="border-emerald-700/40 bg-emerald-500/5 p-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">Owner contact</p>
                    {companyDetail.enrichment.owner_name && (
                      <p className="text-sm text-white">{companyDetail.enrichment.owner_name}</p>
                    )}
                    {companyDetail.enrichment.owner_email && (
                      <a href={`mailto:${companyDetail.enrichment.owner_email}`} className="mt-1 flex items-center gap-2 text-sm text-emerald-400 hover:underline">
                        <Mail className="h-3 w-3" /> {companyDetail.enrichment.owner_email}
                      </a>
                    )}
                    {companyDetail.enrichment.owner_phone && (
                      <a href={`tel:${companyDetail.enrichment.owner_phone}`} className="mt-1 flex items-center gap-2 text-sm text-emerald-400 hover:underline">
                        <Phone className="h-3 w-3" /> {companyDetail.enrichment.owner_phone}
                      </a>
                    )}
                    {companyDetail.enrichment.website && (
                      <a href={companyDetail.enrichment.website} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-2 text-sm text-cyan-400 hover:underline">
                        <Globe className="h-3 w-3" /> {companyDetail.enrichment.website}
                      </a>
                    )}
                  </Card>
                )}

                {companyDetail.pages.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Pages visited</p>
                    <ul className="space-y-1">
                      {companyDetail.pages.map((p) => (
                        <li key={p} className="break-all border-b border-slate-800 py-1.5 text-xs text-slate-300">
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1 text-xs text-slate-500">
                  {companyDetail.firstSeen && (
                    <p><Clock className="mr-1 inline h-3 w-3" /> First: <span className="text-slate-300">{new Date(companyDetail.firstSeen).toLocaleString()}</span></p>
                  )}
                  {companyDetail.lastSeen && (
                    <p><Clock className="mr-1 inline h-3 w-3" /> Last: <span className="text-slate-300">{new Date(companyDetail.lastSeen).toLocaleString()}</span></p>
                  )}
                </div>

                {companyDetail.latestEventId && (
                  <div className="space-y-2">
                    <Button
                      onClick={() => enrich(companyDetail.latestEventId!)}
                      disabled={enrichingIds.has(companyDetail.latestEventId)}
                      className="w-full bg-cyan-400 text-slate-900 hover:bg-cyan-300"
                    >
                      {enrichingIds.has(companyDetail.latestEventId) ? (
                        <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Enriching…</>
                      ) : (
                        <><Sparkles className="mr-1 h-4 w-4" /> Re-enrich company data</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-cyan-700/40 text-cyan-300 hover:bg-cyan-500/10"
                      onClick={async () => {
                        if (!client) return;
                        toast.info("Drafting AI opener…");
                        const { data, error } = await supabase.functions.invoke("siteradar-ai-opener", {
                          body: { client_id: client.id, company_name: companyDetail.name },
                        });
                        if (error) { toast.error("Draft failed", { description: error.message }); return; }
                        const draft = (data as { draft?: string })?.draft || "";
                        await navigator.clipboard.writeText(draft);
                        toast.success("AI opener copied", { description: draft.slice(0, 140) });
                      }}
                    >
                      <Zap className="mr-1 h-4 w-4" /> Draft AI cold opener
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

// ───────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────

function HotVisitorHero({
  visitor,
  onOpen,
  onEnrich,
}: {
  visitor: { name: string; city: string | null; count: number; score: number; signals: Signal[] };
  onOpen: () => void;
  onEnrich: () => void;
}) {
  const tier = tierFromScore(visitor.score);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#0a1628] via-[#0d2547] to-[#0a1628] p-6 shadow-[0_0_60px_-15px_rgba(0,212,255,0.3)]"
    >
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-orange-400">
            Hottest visitor right now
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-2xl font-extrabold text-white md:text-3xl">{visitor.name}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
              {visitor.city && <><MapPin className="h-3 w-3" /> {visitor.city}</>}
              <span>· {visitor.count} visit{visitor.count === 1 ? "" : "s"}</span>
            </p>
            {visitor.signals.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {visitor.signals.map((s) => (
                  <Badge key={s.label} variant="outline" className="border-cyan-700/40 bg-cyan-500/10 text-cyan-300">
                    <span className="mr-1">{s.icon}</span>{s.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <ScoreBadge score={visitor.score} />
            <Badge className={`${tier.ring} ring-1 font-bold ${tier.color}`} variant="outline">
              {tier.label}
            </Badge>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={onOpen} className="bg-cyan-400 text-slate-900 hover:bg-cyan-300">
            <ArrowUpRight className="mr-1 h-4 w-4" /> View profile
          </Button>
          <Button onClick={onEnrich} variant="outline" className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20">
            <Sparkles className="mr-1 h-4 w-4" /> Find owner contact
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function CompanyRow({
  c,
  onClick,
}: {
  c: { name: string; city: string | null; count: number; score: number; signals: Signal[] };
  onClick: () => void;
}) {
  const tier = tierFromScore(c.score);
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-transparent p-2.5 text-left transition hover:border-cyan-500/30 hover:bg-cyan-500/5"
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${tier.ring}`}>
        <span className={`text-sm font-extrabold ${tier.color}`}>{c.score}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-cyan-400 group-hover:text-cyan-300">{c.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          {c.city && <><MapPin className="h-2.5 w-2.5" /> {c.city}</>}
          <span>· {c.count} visit{c.count === 1 ? "" : "s"}</span>
          {c.signals.slice(0, 2).map((s) => (
            <span key={s.label} className="text-cyan-400">{s.icon} {s.label}</span>
          ))}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-slate-600 group-hover:text-cyan-400" />
    </button>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tier = tierFromScore(score);
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ring-1 ${tier.ring}`}>
      <TrendingUp className={`h-3 w-3 ${tier.color}`} />
      <span className={`text-xs font-bold ${tier.color}`}>Intent {score}</span>
    </div>
  );
}

function Stat({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <Card className={`border-cyan-900/40 bg-[#0a1628]/80 p-4 ${accent ? "ring-1 ring-cyan-500/20" : ""}`}>
      <div className="flex items-center gap-1.5 text-slate-400">
        <span className={accent ? "text-cyan-400" : "text-slate-500"}>{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-extrabold md:text-3xl ${accent ? "text-cyan-400" : "text-white"}`}>{value}</p>
    </Card>
  );
}
