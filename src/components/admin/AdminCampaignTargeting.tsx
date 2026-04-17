/**
 * AdminCampaignTargeting — The "brain" that recommends WHO to mail/fax.
 * Cross-cuts Medicare staffing intel, industrial pulse signals, and permit data
 * → ranked prospect list with channel recommendation (postcard vs fax).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Recommendation {
  source: string;
  business_name: string;
  location: string;
  reason: string;
  recommended_channel: "postcard" | "fax";
  recommended_pitch: string;
  confidence: number;
  meta?: any;
}

export default function AdminCampaignTargeting() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "postcard" | "fax">("all");

  async function loadRecs() {
    setLoading(true);
    const out: Recommendation[] = [];

    // Source 1: Medicare 1-2 star staffing → fax CNA pitch (admin offices read fax)
    try {
      const { data } = await supabase.functions.invoke("medicare-staffing-intel", {});
      const facilities = data?.facilities || [];
      for (const f of facilities.slice(0, 30)) {
        out.push({
          source: "🏥 Medicare Staffing Intel",
          business_name: f.provider_name,
          location: `${f.city}, ${f.state} ${f.zip}`,
          reason: `${f.staffing_rating}-star staffing rating · likely desperate for CNAs/RNs now`,
          recommended_channel: "fax",
          recommended_pitch: "TechAlert CNA/RN candidate alerts ($149/mo)",
          confidence: f.staffing_rating === 1 ? 9 : 7,
          meta: f,
        });
      }
    } catch (e) { console.error("[targeting] medicare:", e); }

    // Source 2: Industry pulse signals (manufacturing expansion = postcard target)
    try {
      const { data: signals } = await supabase
        .from("industry_pulse_signals" as any)
        .select("*")
        .gte("confidence", 7)
        .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString())
        .order("confidence", { ascending: false })
        .limit(20);
      for (const s of (signals as any[]) || []) {
        out.push({
          source: "📡 Demand Radar",
          business_name: s.business_name || s.title || "Unknown signal",
          location: s.location || s.city || "Metro Detroit",
          reason: s.summary?.slice(0, 120) || s.signal_type || "High-confidence growth signal",
          recommended_channel: "postcard",
          recommended_pitch: "Web design + TechAlert bundle ($199 setup + $149/mo)",
          confidence: s.confidence || 7,
          meta: s,
        });
      }
    } catch (e) { console.error("[targeting] pulse:", e); }

    // Sort by confidence desc
    out.sort((a, b) => b.confidence - a.confidence);
    setRecs(out);
    setLoading(false);
  }

  useEffect(() => { loadRecs(); }, []);

  const filtered = filter === "all" ? recs : recs.filter(r => r.recommended_channel === filter);

  return (
    <div className="space-y-6 text-white">
      <div>
        <h2 className="text-xl font-bold">🎯 Targeting Brain</h2>
        <p className="text-white/50 text-sm mt-1">
          Cross-cuts Medicare staffing, industrial signals, and permit data → ranked prospects with channel + pitch recommendation.
        </p>
      </div>

      <div className="flex gap-2 items-center">
        <button onClick={loadRecs} disabled={loading}
          className="px-4 py-2 bg-[#00d4ff] text-[#0a1628] rounded font-bold text-sm disabled:opacity-50">
          {loading ? "Scanning…" : "🔄 Refresh Recommendations"}
        </button>
        <div className="flex gap-1 ml-auto">
          {(["all", "postcard", "fax"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded border ${
                filter === f
                  ? "bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/40"
                  : "bg-white/5 text-white/60 border-white/10 hover:border-white/30"
              }`}>
              {f === "all" ? "All" : f === "postcard" ? "📬 Postcard" : "📠 Fax"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#0f1f35] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left text-xs uppercase text-white/40">
              <th className="px-4 py-2">Confidence</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Business</th>
              <th className="px-4 py-2">Why</th>
              <th className="px-4 py-2">Channel</th>
              <th className="px-4 py-2">Pitch</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30">
                {loading ? "Scanning…" : "No recommendations. Click refresh."}
              </td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    r.confidence >= 8 ? "bg-red-500/20 text-red-300"
                    : r.confidence >= 6 ? "bg-amber-500/20 text-amber-300"
                    : "bg-white/10 text-white/60"
                  }`}>{r.confidence}/10</span>
                </td>
                <td className="px-4 py-3 text-white/60 text-xs">{r.source}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.business_name}</div>
                  <div className="text-xs text-white/40">{r.location}</div>
                </td>
                <td className="px-4 py-3 text-white/70 text-xs max-w-md">{r.reason}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    r.recommended_channel === "fax"
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-blue-500/20 text-blue-300"
                  }`}>
                    {r.recommended_channel === "fax" ? "📠 Fax" : "📬 Postcard"}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/60 text-xs">{r.recommended_pitch}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
