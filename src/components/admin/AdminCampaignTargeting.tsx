/**
 * AdminCampaignTargeting — Phase 4: searchable targeting brain.
 * - Search prospects by audience + county (writes to prospect_pool via targeting-prospect-scraper)
 * - "Most Likely" ranked tab from prospect_pool.lead_score
 * - "Send 5 Sample Postcards to My House" button
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const AUDIENCES = [
  { value: "healthcare_staffing", label: "🏥 Healthcare Staffing" },
  { value: "nursing_home", label: "🛏️ Nursing Home" },
  { value: "trades_staffing", label: "🔧 Trades Staffing" },
  { value: "supply_house", label: "🏗️ Supply House" },
  { value: "industrial_mfg", label: "🏭 Industrial Mfg" },
  { value: "senior_care", label: "👴 Senior Care" },
];
const COUNTIES = ["Wayne", "Oakland", "Macomb"];

interface Prospect {
  id: string;
  business_name: string;
  audience_type: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  phone: string | null;
  fax_number: string | null;
  lead_score: number;
  intel_notes: string[] | null;
  source: string;
  channel_hint: string;
  verified_address: boolean;
  verified_fax: boolean;
}

export default function AdminCampaignTargeting() {
  const [tab, setTab] = useState<"search" | "ranked">("ranked");
  const [audience, setAudience] = useState("nursing_home");
  const [county, setCounty] = useState<string>("Wayne");
  const [scoreMin, setScoreMin] = useState(0);
  const [channelFilter, setChannelFilter] = useState<"all" | "postcard" | "fax">("all");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string>("");
  const [sampleMsg, setSampleMsg] = useState<string>("");
  const [sampleSending, setSampleSending] = useState(false);

  async function loadRanked() {
    setLoading(true);
    let q = supabase.from("prospect_pool" as any)
      .select("*")
      .gte("lead_score", scoreMin)
      .order("lead_score", { ascending: false })
      .limit(200);
    if (audience !== "all") q = q.eq("audience_type", audience);
    if (county) q = q.eq("county", county);
    if (channelFilter !== "all") q = q.in("channel_hint", [channelFilter, "both"]);
    const { data, error } = await q;
    if (error) console.error(error);
    setProspects((data as any) || []);
    setLoading(false);
  }

  useEffect(() => { loadRanked(); }, [audience, county, scoreMin, channelFilter]);

  async function runSearch() {
    setSearchMsg("Scanning real sources…");
    const { data, error } = await supabase.functions.invoke("targeting-prospect-scraper", {
      body: { audience_type: audience, county, limit: 75 },
    });
    if (error) { setSearchMsg(`❌ ${error.message}`); return; }
    setSearchMsg(`✅ Found ${data?.found || 0} · Inserted ${data?.inserted || 0} new · ${data?.duplicates || 0} dupes. Scoring runs in background.`);
    setTimeout(loadRanked, 2500);
  }

  async function sendSamplePack() {
    if (!confirm("Send 5 sample postcards to your home address (~$4.25)?")) return;
    setSampleSending(true);
    setSampleMsg("Mailing 5 samples…");
    const { data, error } = await supabase.functions.invoke("send-sample-postcards", {
      body: { audiences: ["healthcare_staffing", "nursing_home", "trades_staffing", "hvac", "supply_house"] },
    });
    setSampleSending(false);
    if (error) { setSampleMsg(`❌ ${error.message}`); return; }
    const ok = (data?.results || []).filter((r: any) => !r.error).length;
    const errs = (data?.results || []).filter((r: any) => r.error);
    setSampleMsg(`✅ Sent ${ok}/5 · Cost $${((data?.total_cost_cents || 0) / 100).toFixed(2)}${errs.length ? ` · Issues: ${errs.map((e: any) => `${e.audience}=${e.error}`).join(", ")}` : ""}`);
  }

  const channelEmoji = (h: string) => h === "fax" ? "📠" : h === "postcard" ? "📬" : "📬📠";

  return (
    <div className="space-y-6 text-white">
      <div>
        <h2 className="text-xl font-bold">🎯 Targeting Brain</h2>
        <p className="text-white/50 text-sm mt-1">
          Real sources per audience · scored 0–100 · ranked most-likely first.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {[
          { k: "ranked", l: "🥇 Most Likely" },
          { k: "search", l: "🔍 Find New Prospects" },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-4 py-2 text-sm font-medium ${tab === t.k ? "text-[#00d4ff] border-b-2 border-[#00d4ff]" : "text-white/50 hover:text-white"}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Search tab */}
      {tab === "search" && (
        <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <label className="text-xs text-white/60">Audience
              <select value={audience} onChange={(e) => setAudience(e.target.value)}
                className="w-full mt-1 bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white">
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">County
              <select value={county} onChange={(e) => setCounty(e.target.value)}
                className="w-full mt-1 bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white">
                {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <button onClick={runSearch}
              className="self-end px-4 py-2 bg-[#00d4ff] text-[#0a1628] rounded font-bold text-sm">
              🔍 Scan Real Sources
            </button>
          </div>
          {searchMsg && <p className="text-sm text-white/70">{searchMsg}</p>}
          <div className="text-xs text-white/40 border-t border-white/10 pt-3">
            <strong>Sources used:</strong> CMS Medicare, NPI Registry, SAM.gov, Sonar B2B, MI LARA. Auto-deduped, auto-scored.
          </div>
        </div>
      )}

      {/* Ranked tab */}
      {tab === "ranked" && (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs text-white/60">Audience
              <select value={audience} onChange={(e) => setAudience(e.target.value)}
                className="block mt-1 bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white">
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">County
              <select value={county} onChange={(e) => setCounty(e.target.value)}
                className="block mt-1 bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white">
                {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">Min score
              <input type="number" min={0} max={100} value={scoreMin} onChange={(e) => setScoreMin(parseInt(e.target.value) || 0)}
                className="block mt-1 w-20 bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white" />
            </label>
            <div className="flex gap-1">
              {(["all", "postcard", "fax"] as const).map((c) => (
                <button key={c} onClick={() => setChannelFilter(c)}
                  className={`px-3 py-1.5 text-xs rounded border ${channelFilter === c ? "bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/40" : "bg-white/5 text-white/60 border-white/10"}`}>
                  {c === "all" ? "All" : c === "postcard" ? "📬" : "📠"}
                </button>
              ))}
            </div>
            <button onClick={loadRanked} disabled={loading}
              className="ml-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm">
              {loading ? "Loading…" : "🔄 Refresh"}
            </button>
          </div>

          {/* Sample pack action */}
          <div className="bg-gradient-to-r from-[#00d4ff]/10 to-transparent border border-[#00d4ff]/30 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold text-[#00d4ff]">📬 Send Sample Pack to My House</div>
              <div className="text-xs text-white/60 mt-0.5">5 personalized postcards (1 per audience), mailed to your home. ~$4.25 via Lob.</div>
            </div>
            <button onClick={sendSamplePack} disabled={sampleSending}
              className="px-4 py-2 bg-[#00d4ff] text-[#0a1628] rounded font-bold text-sm disabled:opacity-50">
              {sampleSending ? "Mailing…" : "Mail 5 Samples"}
            </button>
            {sampleMsg && <div className="w-full text-xs text-white/70">{sampleMsg}</div>}
          </div>

          <div className="bg-[#0f1f35] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase text-white/40">
                  <th className="px-4 py-2">Score</th>
                  <th className="px-4 py-2">Business</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Channel</th>
                  <th className="px-4 py-2">Why</th>
                  <th className="px-4 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {prospects.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-white/30">
                    {loading ? "Loading…" : "No prospects yet for this audience. Switch to '🔍 Find New Prospects' to scan."}
                  </td></tr>
                )}
                {prospects.map((p) => (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        p.lead_score >= 60 ? "bg-emerald-500/20 text-emerald-300"
                        : p.lead_score >= 30 ? "bg-amber-500/20 text-amber-300"
                        : "bg-white/10 text-white/60"
                      }`}>{p.lead_score}/100</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.business_name}</div>
                      {p.phone && <div className="text-xs text-white/40">{p.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/60">
                      {[p.city, p.state, p.zip].filter(Boolean).join(", ") || "—"}
                      {p.county && <div className="text-white/30">{p.county} County</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">{channelEmoji(p.channel_hint)}</td>
                    <td className="px-4 py-3 text-xs text-white/70 max-w-md">
                      {(p.intel_notes || []).join(" · ") || <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40">{p.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
