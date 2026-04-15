import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/layout/SEOHead";
import {
  TrendingUp, Zap, Target, Factory, Briefcase,
  RefreshCw, Loader2, ArrowUpRight, BarChart3,
  Filter,
} from "lucide-react";

interface Signal {
  id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  signal_type: string;
  confidence: number;
  recommended_pitch: string | null;
  hiring_roles: string[];
  hiring_count: number;
  predicted_needs: string[];
  detected_at: string;
  source_urls: string[];
}

interface DashboardData {
  company_name: string;
  stats: { total: number; high_confidence: number; cross_referenced: number; this_week: number };
  signals: Signal[];
}

type ConfFilter = "all" | "cross_referenced" | "high" | "medium";

export default function MyIndustryPulse() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confFilter, setConfFilter] = useState<ConfFilter>("all");

  const fetchData = async () => {
    if (!token) { setError("No dashboard token provided"); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: result, error: err } = await supabase.functions.invoke("get-industry-pulse-dashboard", {
        body: {},
        headers: {},
      });
      // Use GET with query params
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-industry-pulse-dashboard?token=${token}`;
      const res = await fetch(url, {
        headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load dashboard");
      }
      setData(await res.json());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.signals;
    switch (confFilter) {
      case "cross_referenced": return list.filter(s => s.signal_type === "cross_referenced");
      case "high": return list.filter(s => s.confidence >= 7);
      case "medium": return list.filter(s => s.confidence >= 4 && s.confidence < 7);
      default: return list;
    }
  }, [data, confFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030711] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#030711] flex items-center justify-center px-4">
        <div className="text-center">
          <Factory className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">Access Denied</h2>
          <p className="text-white/50 text-sm">{error || "Invalid or expired dashboard link."}</p>
          <a href="/industry-pulse" className="text-[#00d4ff] text-sm mt-4 inline-block hover:underline">
            Get Industry Pulse Intelligence →
          </a>
        </div>
      </div>
    );
  }

  const confBadge = (c: number, type: string) => {
    if (type === "cross_referenced") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">⚡ Cross-Ref</Badge>;
    if (c >= 8) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">🔥 High ({c}/10)</Badge>;
    if (c >= 5) return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">📊 Medium ({c}/10)</Badge>;
    return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px]">📋 ({c}/10)</Badge>;
  };

  return (
    <>
      <SEOHead title={`Industry Pulse — ${data.company_name}`} description="Your predictive sales intelligence dashboard." />
      <div className="min-h-screen bg-[#030711] text-white">
        {/* Header */}
        <header className="border-b border-white/5 bg-[#0a1628]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-[#00d4ff]" />
              <div>
                <h1 className="text-sm font-bold text-white">{data.company_name}</h1>
                <p className="text-[10px] text-white/40">Industry Pulse Intelligence</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchData}
              className="border-white/10 text-white/50 hover:bg-white/5 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Signals", value: data.stats.total, icon: Factory, color: "text-white/70" },
              { label: "High Confidence", value: data.stats.high_confidence, icon: Zap, color: "text-emerald-400" },
              { label: "Cross-Referenced", value: data.stats.cross_referenced, icon: Target, color: "text-amber-400" },
              { label: "This Week", value: data.stats.this_week, icon: BarChart3, color: "text-[#00d4ff]" },
            ].map(s => (
              <div key={s.label} className="bg-[#0f1f35] border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">{s.label}</p>
                </div>
                <p className="text-2xl font-black text-white">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-white/30" />
            {(["all", "cross_referenced", "high", "medium"] as ConfFilter[]).map(f => (
              <Button
                key={f}
                size="sm"
                variant={confFilter === f ? "default" : "outline"}
                onClick={() => setConfFilter(f)}
                className={`text-xs h-7 ${confFilter === f ? "bg-[#00d4ff] text-black" : "border-white/10 text-white/50 hover:bg-white/5"}`}
              >
                {f === "all" ? "All" : f === "cross_referenced" ? "⚡ Cross-Ref" : f === "high" ? "🔥 High" : "📊 Medium"}
              </Button>
            ))}
            <span className="text-xs text-white/30 ml-auto">{filtered.length} signals</span>
          </div>

          {/* Signal Cards */}
          {filtered.length === 0 ? (
            <div className="bg-[#0f1f35] border border-white/10 rounded-xl py-16 text-center">
              <Factory className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No signals match this filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(signal => (
                <div
                  key={signal.id}
                  className={`bg-[#0f1f35] border rounded-xl p-5 ${
                    signal.signal_type === "cross_referenced" ? "border-amber-500/20 ring-1 ring-amber-500/10" :
                    signal.confidence >= 7 ? "border-emerald-500/15" : "border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-white font-bold text-sm">{signal.company_name}</h3>
                        {confBadge(signal.confidence, signal.signal_type)}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/40 mb-3">
                        {signal.location && <span>📍 {signal.location}</span>}
                        {signal.industry && <span>🏭 {signal.industry}</span>}
                        <span>📅 {new Date(signal.detected_at).toLocaleDateString()}</span>
                      </div>

                      {signal.hiring_count > 0 && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <Briefcase className="h-3 w-3 text-[#00d4ff]" />
                          <span className="text-[11px] text-white/60">
                            Hiring {signal.hiring_count}× {signal.hiring_roles.join(", ")}
                          </span>
                        </div>
                      )}

                      {signal.predicted_needs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {signal.predicted_needs.map((need, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-[#00d4ff]/20 text-[#00d4ff]/70 bg-[#00d4ff]/5">
                              {need}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {signal.recommended_pitch && (
                        <p className="text-[11px] text-white/50 italic leading-relaxed">
                          💡 {signal.recommended_pitch}
                        </p>
                      )}
                    </div>

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

                  {signal.source_urls.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap gap-3">
                      {signal.source_urls.map((url, i) => {
                        try {
                          return (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-[#00d4ff]/50 hover:text-[#00d4ff] flex items-center gap-1">
                              <ArrowUpRight className="h-2.5 w-2.5" /> {new URL(url).hostname}
                            </a>
                          );
                        } catch { return null; }
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        <footer className="py-8 border-t border-white/5 text-center">
          <p className="text-white/20 text-[10px]">
            Detroit Web Agency — Industry Pulse Intelligence
          </p>
        </footer>
      </div>
    </>
  );
}
