import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface IndustrialLead {
  company_name: string;
  location: string;
  expansion_type: string;
  details: string;
  news_date: string | null;
  source_url: string | null;
}

interface SectorSignal {
  id: string;
  company_name: string;
  location: string | null;
  signal_type: string | null;
  sector: string | null;
  confidence: number | null;
  recommended_pitch: string | null;
  source_urls: string[] | null;
  detected_at: string | null;
  industry: string | null;
  client_tag: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  "New Plant": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Equipment Acquisition": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Contract Award": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Workforce Expansion": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Facility Upgrade": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const SIGNAL_BADGES: Record<string, { label: string; colors: string; emoji: string }> = {
  compliance_gap: { label: "COMPLIANCE", colors: "bg-red-500/20 text-red-400 border-red-500/30", emoji: "🚨" },
  funding_secured: { label: "FUNDED", colors: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", emoji: "💰" },
  expansion_hiring: { label: "EXPANSION", colors: "bg-blue-500/20 text-blue-400 border-blue-500/30", emoji: "📈" },
};

type TabMode = "growth" | "boiler";

export default function AdminIndustrialIntel() {
  const [tab, setTab] = useState<TabMode>("boiler");
  const [leads, setLeads] = useState<IndustrialLead[]>([]);
  const [signals, setSignals] = useState<SectorSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const { toast } = useToast();

  async function fetchGrowthData() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("industrial-growth-intel");
      if (error) throw error;
      setLeads(data?.leads || []);
      setTotal(data?.total || 0);
      toast({ title: `Found ${data?.total || 0} industrial expansion signals` });
    } catch (e) {
      toast({ title: "Error scanning industrial intel", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchBoilerIntel() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("boiler-sector-intel");
      if (error) throw error;
      toast({ title: `Scanned: ${data?.signals_found || 0} raw, ${data?.signals_inserted || 0} new` });
    } catch (e) {
      toast({ title: "Error scanning boiler intel", description: String(e), variant: "destructive" });
    }
    // Now load from DB
    try {
      const { data: rows } = await supabase
        .from("industry_pulse_signals")
        .select("*")
        .eq("sector", "boiler")
        .order("detected_at", { ascending: false })
        .limit(50);
      setSignals((rows as SectorSignal[]) || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function loadBoilerSignals() {
    const { data: rows } = await supabase
      .from("industry_pulse_signals")
      .select("*")
      .eq("sector", "boiler")
      .order("detected_at", { ascending: false })
      .limit(50);
    setSignals((rows as SectorSignal[]) || []);
  }

  function copyPitch(pitch: string) {
    navigator.clipboard.writeText(pitch);
    toast({ title: "Pitch copied to clipboard" });
  }

  function typeBadge(type: string) {
    const colors = TYPE_COLORS[type] || "bg-white/10 text-white/50 border-white/20";
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${colors}`}>
        {type}
      </span>
    );
  }

  function signalBadge(type: string | null) {
    const b = SIGNAL_BADGES[type || ""] || { label: type || "UNKNOWN", colors: "bg-white/10 text-white/50 border-white/20", emoji: "⚡" };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${b.colors}`}>
        {b.emoji} {b.label}
      </span>
    );
  }

  function pitchEmail(lead: IndustrialLead) {
    const subject = encodeURIComponent(`Workforce Solutions for ${lead.company_name}`);
    const body = encodeURIComponent(
      `Hi,\n\nI came across news about ${lead.company_name}'s recent ${lead.expansion_type.toLowerCase()} in ${lead.location}. Congratulations on the growth!\n\nDetroit Web Agency specializes in connecting Metro Detroit industrial companies with licensed, verified tradespeople — Boiler Operators, Master Plumbers, HVAC Technicians, and Electricians.\n\nOur TechAlert system monitors new license issuances from LARA and MIOSHA daily, delivering verified candidate profiles with direct contact information straight to your inbox.\n\nWould you have 10 minutes this week for a quick call?\n\nBest,\nMatt Michels\nDetroit Web Agency\n(313) 992-1219\ndetroitwebagent.com`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Tab Toggle */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => { setTab("boiler"); loadBoilerSignals(); }}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${tab === "boiler" ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 border-b-0" : "text-white/40 hover:text-white/60"}`}
        >
          🔥 Boiler Sector Intel
        </button>
        <button
          onClick={() => setTab("growth")}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${tab === "growth" ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 border-b-0" : "text-white/40 hover:text-white/60"}`}
        >
          🏭 Growth Scanner
        </button>
      </div>

      {/* ─── BOILER SECTOR TAB ─── */}
      {tab === "boiler" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white/40 text-xs uppercase tracking-wide mb-1">Boiler Sector Intelligence</h2>
              <p className="text-white/60 text-sm">
                MIOSHA compliance gaps, municipal bond funding, expansion hiring — actionable pitches for boiler equipment sales.
              </p>
            </div>
            <button
              onClick={fetchBoilerIntel}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Scanning…" : "🔥 Scan Boiler Intel"}
            </button>
          </div>

          {/* Stats */}
          {signals.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0f1f35] border border-white/10 rounded-lg p-3">
                <p className="text-white/40 text-xs">Total Signals</p>
                <p className="text-2xl font-bold text-white">{signals.length}</p>
              </div>
              <div className="bg-[#0f1f35] border border-red-500/20 rounded-lg p-3">
                <p className="text-white/40 text-xs">🚨 Compliance</p>
                <p className="text-2xl font-bold text-red-400">{signals.filter(s => s.signal_type === "compliance_gap").length}</p>
              </div>
              <div className="bg-[#0f1f35] border border-emerald-500/20 rounded-lg p-3">
                <p className="text-white/40 text-xs">💰 Funded</p>
                <p className="text-2xl font-bold text-emerald-400">{signals.filter(s => s.signal_type === "funding_secured").length}</p>
              </div>
              <div className="bg-[#0f1f35] border border-blue-500/20 rounded-lg p-3">
                <p className="text-white/40 text-xs">📈 Expansion</p>
                <p className="text-2xl font-bold text-blue-400">{signals.filter(s => s.signal_type === "expansion_hiring").length}</p>
              </div>
            </div>
          )}

          {/* Signal Cards */}
          {signals.length > 0 && (
            <div className="space-y-3">
              {signals.map((s) => (
                <div key={s.id} className="bg-[#0f1f35] border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold text-sm">{s.company_name}</h3>
                      {signalBadge(s.signal_type)}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white/30 text-xs">{s.detected_at ? new Date(s.detected_at).toLocaleDateString() : "—"}</span>
                      <span className={`text-xs font-bold ${(s.confidence || 0) >= 8 ? "text-red-400" : (s.confidence || 0) >= 6 ? "text-yellow-400" : "text-white/40"}`}>
                        {s.confidence}/10
                      </span>
                    </div>
                  </div>
                  <p className="text-white/40 text-xs mb-2">{s.location} · {s.industry || "Industrial"}</p>
                  <p className="text-white/70 text-sm leading-relaxed mb-3">{s.recommended_pitch}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyPitch(s.recommended_pitch || "")}
                      className="px-3 py-1.5 rounded bg-[#00d4ff]/10 text-[#00d4ff] text-xs font-medium hover:bg-[#00d4ff]/20 transition-colors border border-[#00d4ff]/20"
                    >
                      📋 Copy Pitch
                    </button>
                    {s.source_urls?.[0] && (
                      <a href={s.source_urls[0]} target="_blank" rel="noreferrer" className="text-[#00d4ff]/60 text-xs hover:text-[#00d4ff]">
                        Source →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && signals.length === 0 && (
            <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/40 text-sm">Click "Scan Boiler Intel" to find MIOSHA compliance gaps, bond-funded projects, and expansion hiring in Metro Detroit.</p>
              <p className="text-white/30 text-xs mt-2">Three signal types scanned in parallel — actionable pitches for every result.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── GROWTH SCANNER TAB (existing) ─── */}
      {tab === "growth" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white/40 text-xs uppercase tracking-wide mb-1">Industrial Growth Scanner</h2>
              <p className="text-white/60 text-sm">
                Metro Detroit manufacturing expansions, equipment acquisitions & contract awards — prime TechAlert prospects.
              </p>
            </div>
            <button
              onClick={fetchGrowthData}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Scanning…" : total > 0 ? "Refresh Data" : "🔍 Scan Industrial News"}
            </button>
          </div>

          {total > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0f1f35] border border-white/10 rounded-lg p-3">
                <p className="text-white/40 text-xs">Total Signals</p>
                <p className="text-2xl font-bold text-white">{total}</p>
              </div>
              <div className="bg-[#0f1f35] border border-emerald-500/20 rounded-lg p-3">
                <p className="text-white/40 text-xs">New Plants</p>
                <p className="text-2xl font-bold text-emerald-400">{leads.filter(l => l.expansion_type === "New Plant").length}</p>
              </div>
              <div className="bg-[#0f1f35] border border-blue-500/20 rounded-lg p-3">
                <p className="text-white/40 text-xs">Equipment</p>
                <p className="text-2xl font-bold text-blue-400">{leads.filter(l => l.expansion_type === "Equipment Acquisition").length}</p>
              </div>
              <div className="bg-[#0f1f35] border border-purple-500/20 rounded-lg p-3">
                <p className="text-white/40 text-xs">Contracts</p>
                <p className="text-2xl font-bold text-purple-400">{leads.filter(l => l.expansion_type === "Contract Award").length}</p>
              </div>
            </div>
          )}

          {leads.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase border-b border-white/10">
                    <th className="text-left py-2 px-3">Company</th>
                    <th className="text-left py-2 px-3">Location</th>
                    <th className="text-center py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Details</th>
                    <th className="text-center py-2 px-3">Date</th>
                    <th className="text-right py-2 px-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-3">
                        <p className="text-white font-medium text-sm">{lead.company_name}</p>
                        {lead.source_url ? (
                          <a href={lead.source_url} target="_blank" rel="noreferrer" className="text-[#00d4ff]/60 text-xs hover:text-[#00d4ff] transition-colors">
                            Source →
                          </a>
                        ) : (
                          <span className="text-white/20 text-xs">No source link</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-white/60">{lead.location}</td>
                      <td className="py-2.5 px-3 text-center">{typeBadge(lead.expansion_type)}</td>
                      <td className="py-2.5 px-3 text-white/50 text-xs max-w-xs truncate" title={lead.details}>{lead.details}</td>
                      <td className="py-2.5 px-3 text-center text-white/40 text-xs">{lead.news_date || "—"}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => pitchEmail(lead)}
                          className="px-3 py-1.5 rounded bg-[#00d4ff]/10 text-[#00d4ff] text-xs font-medium hover:bg-[#00d4ff]/20 transition-colors border border-[#00d4ff]/20"
                          title="Opens email draft with TechAlert pitch"
                        >
                          📧 TechAlert Pitch
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && leads.length === 0 && total === 0 && (
            <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/40 text-sm">Click "Scan Industrial News" to find Metro Detroit companies expanding operations.</p>
              <p className="text-white/30 text-xs mt-2">Uses web intelligence to identify companies that urgently need skilled tradespeople.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
