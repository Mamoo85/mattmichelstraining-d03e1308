import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Factory, Zap, TrendingUp, Filter, RefreshCw,
  Loader2, ArrowUpRight, Briefcase, Target
} from "lucide-react";

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

type FilterType = "all" | "cross_referenced" | "high" | "medium" | "low";

const INDUSTRY_FILTERS = ["All", "HVAC", "CNC/Machining", "Welding", "Electrical", "Boiler/Pressure", "Plumbing"];

export default function AdminGrowthSignals() {
  const [signals, setSignals] = useState<PulseSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState<FilterType>("all");
  const [industryFilter, setIndustryFilter] = useState("All");

  useEffect(() => { fetchSignals(); }, []);

  async function fetchSignals() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("industry_pulse_signals")
      .select("*")
      .order("confidence", { ascending: false })
      .order("detected_at", { ascending: false })
      .limit(200);

    if (!error && data) setSignals(data);
    setLoading(false);
  }

  async function runScanner() {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("industry-pulse-scanner");
      if (error) throw error;
      toast.success(`Scan complete: ${data?.signals_found || 0} signals found`);
      await fetchSignals();
    } catch (e: any) {
      toast.error("Scanner failed: " + (e.message || "unknown error"));
    } finally {
      setScanning(false);
    }
  }

  const filtered = useMemo(() => {
    let list = signals;
    if (industryFilter !== "All") list = list.filter(s => s.industry === industryFilter);
    switch (confidenceFilter) {
      case "cross_referenced": list = list.filter(s => s.cross_referenced); break;
      case "high": list = list.filter(s => s.confidence >= 7); break;
      case "medium": list = list.filter(s => s.confidence >= 4 && s.confidence < 7); break;
      case "low": list = list.filter(s => s.confidence < 4); break;
    }
    return list;
  }, [signals, confidenceFilter, industryFilter]);

  const stats = useMemo(() => ({
    total: signals.length,
    highConf: signals.filter(s => s.confidence >= 7).length,
    crossRef: signals.filter(s => s.cross_referenced).length,
  }), [signals]);

  const confidenceBadge = (c: number, crossRef: boolean) => {
    if (crossRef) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">⚡ Cross-Referenced</Badge>;
    if (c >= 8) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">🔥 High ({c}/10)</Badge>;
    if (c >= 5) return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">📊 Medium ({c}/10)</Badge>;
    return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px]">📋 Low ({c}/10)</Badge>;
  };

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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {(["all", "cross_referenced", "high", "medium", "low"] as FilterType[]).map(f => (
            <Button
              key={f}
              size="sm"
              variant={confidenceFilter === f ? "default" : "outline"}
              onClick={() => setConfidenceFilter(f)}
              className={`text-xs ${confidenceFilter === f ? "bg-[#00d4ff] text-black" : "border-white/10 text-white/50 hover:bg-white/5"}`}
            >
              {f === "all" ? "All" : f === "cross_referenced" ? "⚡ Cross-Ref" : f === "high" ? "🔥 High" : f === "medium" ? "📊 Medium" : "📋 Low"}
            </Button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {INDUSTRY_FILTERS.map(ind => (
            <Button
              key={ind}
              size="sm"
              variant={industryFilter === ind ? "default" : "outline"}
              onClick={() => setIndustryFilter(ind)}
              className={`text-xs ${industryFilter === ind ? "bg-white/10 text-white" : "border-white/10 text-white/40 hover:bg-white/5"}`}
            >
              {ind}
            </Button>
          ))}
        </div>
      </div>

      {/* Signal Cards */}
      {filtered.length === 0 ? (
        <Card className="bg-[#0f1f35] border-white/10">
          <CardContent className="py-12 text-center">
            <Factory className="h-10 w-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No signals match your filters.</p>
            <p className="text-white/30 text-xs mt-1">Try running the scanner or adjusting filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(signal => (
            <Card key={signal.id} className={`bg-[#0f1f35] border-white/10 ${signal.cross_referenced ? "ring-1 ring-amber-500/20" : signal.confidence >= 7 ? "ring-1 ring-emerald-500/10" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold text-sm">{signal.company_name}</h3>
                      {confidenceBadge(signal.confidence, signal.cross_referenced)}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-white/40 mb-2">
                      {signal.location && <span>📍 {signal.location}</span>}
                      {signal.industry && <span>🏭 {signal.industry}</span>}
                      <span>📅 {new Date(signal.detected_at).toLocaleDateString()}</span>
                    </div>

                    {/* What they're hiring */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <Briefcase className="h-3 w-3 text-[#00d4ff]" />
                      <span className="text-[11px] text-white/60">
                        Hiring {signal.hiring_count}× {signal.hiring_roles.join(", ")}
                      </span>
                    </div>

                    {/* Predicted needs */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {signal.predicted_needs.map((need, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-[#00d4ff]/20 text-[#00d4ff]/70 bg-[#00d4ff]/5">
                          {need}
                        </Badge>
                      ))}
                    </div>

                    {/* Pitch recommendation */}
                    {signal.recommended_pitch && (
                      <p className="text-[11px] text-white/50 italic leading-relaxed">
                        💡 {signal.recommended_pitch}
                      </p>
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

                {/* Source links */}
                {signal.source_urls.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    {signal.source_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#00d4ff]/50 hover:text-[#00d4ff] flex items-center gap-1">
                        <ArrowUpRight className="h-2.5 w-2.5" /> {new URL(url).hostname}
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
