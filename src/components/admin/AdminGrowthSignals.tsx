import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Factory, Zap, TrendingUp, RefreshCw, Loader2, ArrowUpRight,
  Briefcase, Target, Copy, X, Mail, Download, ExternalLink,
  CheckCircle2, MessageSquare, Bookmark, BookmarkCheck, Users,
  ChevronDown, ChevronUp, FileText,
} from "lucide-react";
import BuyerOutreachDialog from "./BuyerOutreachDialog";
import IndustryPulseConfidenceLegend from "./IndustryPulseConfidenceLegend";
import GrowthSignalsDebugPanel, { type IndustryCount, type QueryMeta } from "./GrowthSignalsDebugPanel";

const PAGE_SIZE = 25;
// Filter-aware fetch caps. The OLD bug: a single LIMIT 80 ran BEFORE filters,
// so confidence-6 ties pushed entire industries (Boiler/Pressure) past the cap.
// New approach: industry filter is pushed to SQL, then we use a generous cap.
const FETCH_LIMIT_ALL = 300;        // global view ("All" industries)
const FETCH_LIMIT_FILTERED = 1000;  // single industry — never truncates a real-world tenant
const VISIBLE_NEED_CHIPS = 3;
const STORAGE_KEY = "dwa_growth_signals_filters_v2";

interface PulseSignal {
  id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  hiring_roles: string[];
  hiring_count: number;
  predicted_needs: string[];
  confidence: number;
  recommended_pitch: string | null;
  source_urls: string[];
  cross_referenced: boolean;
  detected_at: string;
}

type FilterType = "all" | "cross_referenced" | "high" | "medium" | "low" | "watchlist";

const INDUSTRY_FILTERS = ["All", "HVAC", "CNC/Machining", "Welding", "Electrical", "Boiler/Pressure", "Plumbing"];

export default function AdminGrowthSignals() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Restore filters: URL ?industry= & ?confidence= take precedence, then localStorage, then defaults
  const initialFilters = (() => {
    const urlIndustry = searchParams.get("industry");
    const urlConfidence = searchParams.get("confidence") as FilterType | null;
    if (urlIndustry || urlConfidence) {
      return { industry: urlIndustry || "All", confidence: (urlConfidence || "all") as FilterType };
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.industry && saved?.confidence) return saved;
    } catch { /* ignore */ }
    return { industry: "All", confidence: "all" as FilterType };
  })();

  const [signals, setSignals] = useState<PulseSignal[]>([]);
  const [counts, setCounts] = useState<IndustryCount[]>([]);
  const [queryMeta, setQueryMeta] = useState<QueryMeta>({
    industry: initialFilters.industry, confidence: initialFilters.confidence,
    fetchLimit: FETCH_LIMIT_ALL, returned: 0, totalForFilter: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState<FilterType>(initialFilters.confidence);
  const [industryFilter, setIndustryFilter] = useState(initialFilters.industry);
  const [pitchSignal, setPitchSignal] = useState<PulseSignal | null>(null);
  const [outreachSignal, setOutreachSignal] = useState<PulseSignal | null>(null);
  const [copied, setCopied] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [generatingDossier, setGeneratingDossier] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("dwa_radar_watchlist") || "[]"); } catch { return []; }
  });

  function toggleDetails(id: string) {
    setExpandedDetails(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function generateDossier(s: PulseSignal) {
    setGeneratingDossier(s.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-signal-dossier", {
        body: { signal_id: s.id },
      });
      if (error) throw error;
      if (data?.html) {
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(data.html);
          w.document.close();
          setTimeout(() => w.print(), 500);
        }
      }
      toast.success(`Dossier ready for ${s.company_name}`);
    } catch (e: any) {
      toast.error("Dossier failed: " + (e.message || "unknown"));
    } finally {
      setGeneratingDossier(null);
    }
  }

  function toggleWatch(company: string) {
    const updated = watchlist.includes(company) ? watchlist.filter(c => c !== company) : [...watchlist, company];
    setWatchlist(updated);
    localStorage.setItem("dwa_radar_watchlist", JSON.stringify(updated));
    toast.success(updated.includes(company) ? `Watching "${company}"` : `Removed "${company}" from watchlist`);
  }

  // Deterministic "competitor watchers" based on signal ID hash — creates FOMO
  function competitorCount(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
    return 2 + Math.abs(hash % 5); // 2-6 competitors
  }

  // ── Counts: total, high/medium/low, cross-ref per industry. Fed by SQL view.
  // Refreshes on mount + after every scan so pill counts are always honest.
  const fetchCounts = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("industry_pulse_signals_counts")
      .select("*");
    if (!error && data) setCounts(data as IndustryCount[]);
  }, []);

  // ── Server-side filtered fetch. Runs whenever industry or confidence changes.
  // Confidence buckets are pushed to SQL — no more client-side hiding.
  // Deterministic tie-break: confidence DESC, detected_at DESC, id ASC
  // (the id leg guarantees identical sorts across reloads, paginations, and tabs).
  const fetchSignals = useCallback(async () => {
    const isInitial = signals.length === 0;
    isInitial ? setLoading(true) : setRefetching(true);

    const fetchLimit = industryFilter === "All" ? FETCH_LIMIT_ALL : FETCH_LIMIT_FILTERED;

    let q = (supabase as any)
      .from("industry_pulse_signals")
      .select("*", { count: "exact" });

    if (industryFilter !== "All") q = q.eq("industry", industryFilter);

    switch (confidenceFilter) {
      case "high":             q = q.gte("confidence", 7); break;
      case "medium":           q = q.gte("confidence", 4).lt("confidence", 7); break;
      case "low":              q = q.lt("confidence", 4); break;
      case "cross_referenced": q = q.eq("cross_referenced", true); break;
      // "all" and "watchlist" → no SQL constraint (watchlist filtered client-side)
    }

    const { data, count, error } = await q
      .order("confidence",  { ascending: false })
      .order("detected_at", { ascending: false })
      .order("id",          { ascending: true })
      .limit(fetchLimit);

    if (error) {
      toast.error("Failed to load signals: " + error.message);
      setLoading(false); setRefetching(false);
      return;
    }

    // Client-side junk filter for company-name aggregator noise — applied AFTER
    // the server query so it never causes a "filter ate everything" silent zero.
    const JUNK = ["indeed", "ziprecruiter", "linkedin", "multiple employers", "various", "confidential"];
    const cleaned = (data || []).filter((s: PulseSignal) => !JUNK.some(j => s.company_name.toLowerCase().includes(j)));

    setSignals(cleaned);
    setQueryMeta({
      industry: industryFilter,
      confidence: confidenceFilter,
      fetchLimit,
      returned: cleaned.length,
      totalForFilter: count ?? cleaned.length,
    });
    setLoading(false); setRefetching(false);
  }, [industryFilter, confidenceFilter, signals.length]);

  // Initial mount: load counts + first signal page
  useEffect(() => {
    fetchCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch whenever filters change (debounced via React batching)
  useEffect(() => {
    fetchSignals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industryFilter, confidenceFilter]);

  // Persist filter choices: URL + localStorage
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (industryFilter === "All") next.delete("industry"); else next.set("industry", industryFilter);
      if (confidenceFilter === "all") next.delete("confidence"); else next.set("confidence", confidenceFilter);
      return next;
    }, { replace: true });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ industry: industryFilter, confidence: confidenceFilter })); } catch { /* ignore */ }
  }, [industryFilter, confidenceFilter, setSearchParams]);

  async function runScanner() {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("industry-pulse-scanner");
      if (error) throw error;
      toast.success(`Scan complete: ${data?.signals_found || 0} signals found`);
      await Promise.all([fetchSignals(), fetchCounts()]);
    } catch (e: any) {
      toast.error("Scanner failed: " + (e.message || "unknown error"));
    } finally {
      setScanning(false);
    }
  }

  // Watchlist filter is the only client-side filter remaining (small list, instant)
  const filtered = useMemo(() => {
    if (confidenceFilter === ("watchlist" as any)) {
      return signals.filter(s => watchlist.includes(s.company_name));
    }
    return signals;
  }, [signals, confidenceFilter, watchlist]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // Reset pagination when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [confidenceFilter, industryFilter]);

  // Stats are sourced from the counts view (DB-truth) — never from the
  // truncated visible page. This is the foundation that prevents the old
  // "filter shows 0 because we never fetched the data" bug.
  const stats = useMemo(() => {
    const sum = (k: keyof IndustryCount) =>
      counts.reduce((s, c) => s + (typeof c[k] === "number" ? (c[k] as number) : 0), 0);
    return {
      total:    sum("total"),
      highConf: sum("high"),
      medConf:  sum("medium"),
      lowConf:  sum("low"),
      crossRef: sum("cross_ref"),
    };
  }, [counts]);

  // Per-industry total used by industry filter pills
  const industryCount = useCallback((ind: string) => {
    if (ind === "All") return stats.total;
    return counts.find(c => c.industry === ind)?.total ?? 0;
  }, [counts, stats.total]);

  // Confidence-bucket totals respecting the active industry filter
  const bucketCount = useCallback((bucket: FilterType): number => {
    const rows = industryFilter === "All" ? counts : counts.filter(c => c.industry === industryFilter);
    switch (bucket) {
      case "all":              return rows.reduce((s, c) => s + c.total, 0);
      case "high":             return rows.reduce((s, c) => s + c.high, 0);
      case "medium":           return rows.reduce((s, c) => s + c.medium, 0);
      case "low":              return rows.reduce((s, c) => s + c.low, 0);
      case "cross_referenced": return rows.reduce((s, c) => s + c.cross_ref, 0);
      default:                 return 0;
    }
  }, [counts, industryFilter]);

  const confidenceBadge = (c: number, crossRef: boolean) => {
    if (crossRef) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Cross-Referenced</Badge>;
    if (c >= 8) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">High ({c}/10)</Badge>;
    if (c >= 5) return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">Medium ({c}/10)</Badge>;
    return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px]">Low ({c}/10)</Badge>;
  };

  function generatePitch(s: PulseSignal): string {
    return `Hi,

I noticed ${s.company_name}${s.location ? ` in ${s.location}` : ""} is actively hiring ${s.hiring_count}+ ${s.hiring_roles.join(", ")} positions. That kind of hiring volume usually signals a major expansion or new contracts.

Based on your growth trajectory, you'll likely need:
${s.predicted_needs.map(n => `  - ${n}`).join("\n")}

Detroit Web Agency works with Metro Detroit industrial companies to streamline their supply chain and workforce during growth phases. We can help ensure your new teams have the equipment, tools, and support they need from day one.

Worth a quick 10-minute call this week?

Best,
Matt Michels
Detroit Web Agency
(313) 992-1219
detroitwebagent.com`;
  }

  function copyPitch(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Pitch copied to clipboard");
  }

  function openEmail(s: PulseSignal) {
    const subject = encodeURIComponent(`Growth Support for ${s.company_name}`);
    const body = encodeURIComponent(generatePitch(s));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function exportCSV() {
    const headers = ["Company", "Location", "Industry", "Hiring Roles", "Count", "Predicted Needs", "Confidence", "Cross-Referenced", "Pitch", "Date"];
    const rows = filtered.map(s => [
      s.company_name,
      s.location || "",
      s.industry || "",
      s.hiring_roles.join("; "),
      s.hiring_count,
      s.predicted_needs.join("; "),
      s.confidence,
      s.cross_referenced ? "Yes" : "No",
      (s.recommended_pitch || "").replace(/\n/g, " "),
      new Date(s.detected_at).toLocaleDateString(),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `growth-signals-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} signals to CSV`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#00d4ff]" /> Growth Signals
          </h2>
          <p className="text-white/40 text-xs mt-1">Hiring patterns → predicted equipment & service needs</p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <Button
              size="sm"
              onClick={exportCSV}
              className="bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
            >
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
          )}
          <Button
            size="sm"
            onClick={runScanner}
            disabled={scanning}
            className="bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20"
          >
            {scanning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            {scanning ? "Scanning..." : "Run Pulse Scanner"}
          </Button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Signals", value: stats.total, icon: Factory, color: "text-white/70" },
          { label: "High Confidence", value: stats.highConf, icon: Zap, color: "text-emerald-400" },
          { label: "Cross-Referenced", value: stats.crossRef, icon: Target, color: "text-amber-400" },
        ].map(s => (
          <Card key={s.label} className="bg-[#0f1f35] border-white/10">
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <div>
                <p className="text-xl font-black text-white">{s.value}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wide">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monetization Banner */}
      {stats.total > 0 && (
        <div className="bg-gradient-to-r from-[#00d4ff]/5 to-[#a371f7]/5 border border-[#00d4ff]/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-xs font-bold">Demand Radar — Sell This Intelligence</p>
              <p className="text-white/40 text-[10px] mt-0.5">
                {stats.highConf} high-confidence signals = {stats.highConf} warm leads for supply houses & equipment distributors.
                Package as $99/mo subscription.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[#00d4ff] text-xs font-mono font-bold">${stats.highConf * 99}/mo potential</span>
            </div>
          </div>
        </div>
      )}

      {/* Confidence-bucket explainer (collapsible). Tells users why
          institutional buyers like Stellantis cap at confidence 6. */}
      <IndustryPulseConfidenceLegend />

      {/* Filter pills with LIVE counts from the SQL counts view. If a pill
          shows (0), the data genuinely doesn't exist — not a frontend bug. */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-1">
          {(["all", "cross_referenced", "high", "medium", "low", "watchlist"] as FilterType[]).map(f => {
            const count = f === "watchlist" ? watchlist.length : bucketCount(f);
            const label = ({ all: "All", cross_referenced: "Cross-Ref", high: "High", medium: "Medium", low: "Low", watchlist: "Watchlist" } as Record<string, string>)[f];
            return (
              <Button
                key={f}
                size="sm"
                variant={confidenceFilter === f ? "default" : "outline"}
                onClick={() => setConfidenceFilter(f)}
                className={`text-xs ${confidenceFilter === f ? "bg-[#00d4ff] text-black" : "border-white/10 text-white/50 hover:bg-white/5"} ${count === 0 && f !== "all" ? "opacity-40" : ""}`}
              >
                {label} <span className={`ml-1 text-[10px] ${confidenceFilter === f ? "text-black/60" : "text-white/30"}`}>({count})</span>
              </Button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1 ml-auto">
          {INDUSTRY_FILTERS.map(ind => {
            const count = industryCount(ind);
            return (
              <Button
                key={ind}
                size="sm"
                variant={industryFilter === ind ? "default" : "outline"}
                onClick={() => setIndustryFilter(ind)}
                className={`text-xs ${industryFilter === ind ? "bg-white/10 text-white" : "border-white/10 text-white/40 hover:bg-white/5"} ${count === 0 && ind !== "All" ? "opacity-40" : ""}`}
              >
                {ind} <span className={`ml-1 text-[10px] ${industryFilter === ind ? "text-white/60" : "text-white/25"}`}>({count})</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Refetch indicator (subtle, in-place) */}
      {refetching && (
        <div className="flex items-center gap-2 text-[11px] text-white/40">
          <Loader2 className="h-3 w-3 animate-spin" /> Updating signals…
        </div>
      )}

      {/* Signal Cards (or diagnostic empty state) */}
      {filtered.length === 0 ? (
        <GrowthSignalsDebugPanel
          meta={queryMeta}
          counts={counts}
          onSwitchConfidence={(c) => setConfidenceFilter(c as FilterType)}
          onClearIndustry={() => setIndustryFilter("All")}
          onRunScanner={runScanner}
        />
      ) : (
        <div className="space-y-3">
          {visible.map(signal => {
            const isExpanded = expandedDetails.has(signal.id);
            const visibleNeeds = isExpanded ? signal.predicted_needs : signal.predicted_needs.slice(0, VISIBLE_NEED_CHIPS);
            const hiddenNeedsCount = Math.max(0, signal.predicted_needs.length - VISIBLE_NEED_CHIPS);
            return (
            <Card key={signal.id} className={`bg-[#0f1f35] border-white/10 ${signal.cross_referenced ? "ring-1 ring-amber-500/20" : signal.confidence >= 7 ? "ring-1 ring-emerald-500/10" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(signal.company_name + " " + (signal.location || "Michigan"))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white font-bold text-sm hover:text-[#00d4ff] transition-colors flex items-center gap-1"
                      >
                        {signal.company_name}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                      {confidenceBadge(signal.confidence, signal.cross_referenced)}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-white/40 mb-2">
                      {signal.location && <span className="flex items-center gap-0.5"><span className="text-red-400/60">*</span> {signal.location}</span>}
                      {signal.industry && <span className="flex items-center gap-0.5"><Factory className="w-2.5 h-2.5" /> {signal.industry}</span>}
                      <span>{new Date(signal.detected_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-2">
                      <Briefcase className="h-3 w-3 text-[#00d4ff]" />
                      <span className="text-[11px] text-white/60">
                        Hiring {signal.hiring_count}x {signal.hiring_roles.join(", ")}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {visibleNeeds.map((need, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-[#00d4ff]/20 text-[#00d4ff]/70 bg-[#00d4ff]/5">
                          {need}
                        </Badge>
                      ))}
                      {!isExpanded && hiddenNeedsCount > 0 && (
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/40 bg-white/5">
                          +{hiddenNeedsCount} more
                        </Badge>
                      )}
                    </div>

                    {/* Details (collapsed by default for DOM weight) */}
                    {isExpanded && signal.recommended_pitch && (
                      <p className="text-[11px] text-white/50 italic leading-relaxed mb-2">
                        {signal.recommended_pitch}
                      </p>
                    )}

                    {/* Action row */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 flex-wrap">
                      <button
                        onClick={() => toggleDetails(signal.id)}
                        className="px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors border bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Details
                      </button>
                      <button
                        onClick={() => toggleWatch(signal.company_name)}
                        className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors border ${watchlist.includes(signal.company_name) ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-white/5 text-white/30 border-white/10 hover:bg-white/10"}`}
                      >
                        {watchlist.includes(signal.company_name) ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                        {watchlist.includes(signal.company_name) ? "Watching" : "Watch"}
                      </button>
                      <button
                        onClick={() => setPitchSignal(signal)}
                        className="px-3 py-1.5 rounded bg-[#00d4ff]/10 text-[#00d4ff] text-xs font-medium hover:bg-[#00d4ff]/20 transition-colors border border-[#00d4ff]/20 flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" /> Pitch
                      </button>
                      <button
                        onClick={() => generateDossier(signal)}
                        disabled={generatingDossier === signal.id}
                        className="px-3 py-1.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 flex items-center gap-1 disabled:opacity-50"
                      >
                        {generatingDossier === signal.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                        Dossier
                      </button>
                      <button
                        onClick={() => setOutreachSignal(signal)}
                        className="px-3 py-1.5 rounded bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors border border-amber-500/20 flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" /> Cold Email
                      </button>
                      {signal.confidence >= 6 && (
                        <span className="text-[10px] text-white/20 flex items-center gap-1 ml-auto">
                          <Users className="w-3 h-3" /> {competitorCount(signal.id)} watching
                        </span>
                      )}
                    </div>

                    {/* Source links — only when expanded (DOM weight reduction) */}
                    {isExpanded && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {signal.source_urls.map((url, i) => {
                          const fullUrl = url.startsWith("http") ? url : `https://${url}`;
                          const isGeneric = fullUrl === "https://www.indeed.com" || fullUrl === "http://www.indeed.com" || url === "www.indeed.com";
                          const linkUrl = isGeneric
                            ? `https://www.indeed.com/jobs?q=${encodeURIComponent(signal.company_name)}&l=${encodeURIComponent(signal.location || "Michigan")}`
                            : fullUrl;
                          let displayHost = "Source";
                          try { displayHost = new URL(fullUrl).hostname.replace("www.", ""); } catch {}
                          return (
                            <a key={i} href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#00d4ff]/50 hover:text-[#00d4ff] flex items-center gap-1">
                              <ArrowUpRight className="h-2.5 w-2.5" /> {isGeneric ? `Indeed jobs` : displayHost}
                            </a>
                          );
                        })}
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(signal.company_name + " " + (signal.location || "Michigan") + " hiring")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-white/30 hover:text-[#00d4ff] flex items-center gap-1"
                        >
                          <ArrowUpRight className="h-2.5 w-2.5" /> Google
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Confidence meter */}
                  <div className="shrink-0 text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black ${
                      signal.confidence >= 8 ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30" :
                      signal.confidence >= 5 ? "bg-cyan-500/20 text-cyan-400" :
                      "bg-slate-500/20 text-slate-400"
                    }`}>
                      {signal.confidence}
                    </div>
                    <p className="text-[9px] text-white/30 mt-1">/ 10</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-2">
              <Button
                size="sm"
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
              >
                Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more ({filtered.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── PITCH MODAL ─────────────────────────────────────────────── */}
      {pitchSignal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPitchSignal(null)}>
          <div
            className="bg-[#0f1f35] border border-white/10 rounded-xl max-w-lg w-full max-h-[80vh] overflow-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h3 className="text-white font-bold text-sm">Growth Signal Pitch</h3>
                <p className="text-white/40 text-xs">{pitchSignal.company_name} — {pitchSignal.industry}</p>
              </div>
              <button onClick={() => setPitchSignal(null)} className="text-white/30 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Signal summary */}
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-1">Why pitch this company</p>
              <p className="text-white/50 text-xs leading-relaxed">
                {pitchSignal.company_name} is hiring {pitchSignal.hiring_count}+ {pitchSignal.hiring_roles.join(", ")} — scoring {pitchSignal.confidence}/10 confidence.
                {pitchSignal.cross_referenced ? " This company also appears in industrial expansion news (cross-referenced)." : ""}
                {" "}Predicted needs: {pitchSignal.predicted_needs.slice(0, 4).join(", ")}.
              </p>
            </div>

            <div className="p-4">
              <pre className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-black/20 rounded-lg p-4 border border-white/5">
                {generatePitch(pitchSignal)}
              </pre>
            </div>

            <div className="flex items-center gap-2 p-4 border-t border-white/10">
              <button
                onClick={() => copyPitch(generatePitch(pitchSignal))}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 transition-colors text-sm font-medium"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Pitch"}
              </button>
              <button
                onClick={() => openEmail(pitchSignal)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium"
              >
                <Mail className="w-4 h-4" /> Open in Email
              </button>
            </div>
          </div>
        </div>
      )}

      <BuyerOutreachDialog
        open={!!outreachSignal}
        onOpenChange={(v) => { if (!v) setOutreachSignal(null); }}
        signal={outreachSignal ? {
          id: outreachSignal.id,
          company_name: outreachSignal.company_name,
          industry: outreachSignal.industry || null,
          predicted_needs: outreachSignal.predicted_needs || [],
        } : null}
      />
    </div>
  );
}
