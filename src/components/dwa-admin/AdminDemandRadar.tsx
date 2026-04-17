import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Radar, Zap } from "lucide-react";

interface Signal {
  id: string;
  company_name: string | null;
  location: string | null;
  industry: string | null;
  vertical: string | null;
  expansion_type: string | null;
  hiring_count: number | null;
  hiring_roles: string[] | null;
  predicted_needs: string | null;
  confidence: number | null;
  cross_referenced: boolean | null;
  detected_at: string;
  recommended_pitch: string | null;
  source_url: string | null;
}

const VERTICALS = [
  "industrial_general",
  "steel",
  "plumbing_supply",
  "roofing_supply",
  "hvac_supply",
  "electrical_supply",
  "concrete",
  "lumber",
];

export default function AdminDemandRadar() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("industry_pulse_signals" as any)
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setSignals((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const triggerEnrich = async (vertical: string) => {
    setEnriching(vertical);
    try {
      const { error } = await supabase.functions.invoke("industrial-growth-intel", {
        body: { vertical, manual: true },
      });
      if (error) throw error;
      toast.success(`Enrich triggered for ${vertical}`);
      setTimeout(load, 3000);
    } catch (e: any) {
      toast.error(e.message || "Enrich failed");
    } finally {
      setEnriching(null);
    }
  };

  const filtered = filter === "all" ? signals : signals.filter((s) => s.vertical === filter);

  const confColor = (c: number | null) => {
    if (!c) return "bg-white/10 text-white/50 border-white/10";
    if (c >= 8) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    if (c >= 6) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    return "bg-white/10 text-white/40 border-white/10";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white text-lg font-bold flex items-center gap-2">
            <Radar size={20} className="text-[#00d4ff]" />
            Demand Radar — Live Signal Feed
          </h2>
          <p className="text-white/50 text-xs mt-1">
            Multi-vertical expansion intelligence. Confidence ≥8 = Perfect Storm eligible.
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 hover:border-[#00d4ff]/40 text-white/70 text-xs"
        >
          Refresh
        </button>
      </div>

      {/* Manual enrich grid */}
      <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-4">
        <p className="text-white/40 text-xs uppercase tracking-wide mb-3">Manual Enrich</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VERTICALS.map((v) => (
            <button
              key={v}
              onClick={() => triggerEnrich(v)}
              disabled={enriching === v}
              className="px-3 py-2 rounded-md bg-white/5 border border-white/10 hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/5 text-white/70 text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {enriching === v ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              {v.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-full text-xs border ${
            filter === "all"
              ? "bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/30"
              : "bg-white/5 text-white/50 border-white/10"
          }`}
        >
          All ({signals.length})
        </button>
        {VERTICALS.map((v) => {
          const count = signals.filter((s) => s.vertical === v).length;
          if (count === 0) return null;
          return (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1 rounded-full text-xs border ${
                filter === v
                  ? "bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/30"
                  : "bg-white/5 text-white/50 border-white/10"
              }`}
            >
              {v.replace(/_/g, " ")} ({count})
            </button>
          );
        })}
      </div>

      {/* Signals */}
      {loading ? (
        <div className="text-white/40 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading signals…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-white/40 text-sm bg-[#0f1f35] border border-white/10 rounded-xl p-6 text-center">
          No signals yet. Trigger a manual enrich above.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="bg-[#0f1f35] border border-white/10 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm">{s.company_name || "Unknown"}</span>
                    {s.cross_referenced && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
                        ⚡ Cross-Referenced
                      </span>
                    )}
                    {s.vertical && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-white/50 border border-white/10">
                        {s.vertical.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <p className="text-white/50 text-xs mt-1">
                    {s.location || "—"} · {s.expansion_type || s.industry || "expansion"}
                  </p>
                  {s.predicted_needs && (
                    <p className="text-white/70 text-xs mt-2 line-clamp-2">{s.predicted_needs}</p>
                  )}
                  {s.recommended_pitch && (
                    <p className="text-[#00d4ff]/70 text-xs mt-2 italic line-clamp-2">
                      💡 {s.recommended_pitch}
                    </p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold border ${confColor(
                      s.confidence
                    )}`}
                  >
                    {s.confidence ?? "—"}/10
                  </span>
                  <span className="text-white/30 text-[10px]">
                    {new Date(s.detected_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
