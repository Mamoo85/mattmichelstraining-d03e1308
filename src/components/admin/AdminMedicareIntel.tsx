import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { X, Copy, Mail, ExternalLink, Info, Trash2, CheckCircle2, ArrowUp, ArrowDown, Search } from "lucide-react";
import IntelRowActions from "./IntelRowActions";
import { US_METROS } from "@/lib/usMetros";

// Build state→metro index from canonical US_METROS list (DFW, Houston, Atlanta, Phoenix, Detroit…)
const STATE_METROS: Record<string, { id: string; label: string }[]> = US_METROS.reduce((acc, m) => {
  (acc[m.state] ||= []).push({ id: m.id, label: m.label });
  return acc;
}, {} as Record<string, { id: string; label: string }[]>);
const STATE_OPTIONS = Object.keys(STATE_METROS).sort();

type SortKey = "provider_name" | "city" | "staffing_rating" | "overall_rating" | "number_of_beds";
const MARKET_KEY = "dwa_medicare_market";

interface Facility {
  provider_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  overall_rating: number | null;
  staffing_rating: number | null;
  rn_staffing_hours: number | null;
  ownership_type: string | null;
  number_of_beds: number | null;
}

const SAVED_KEY = "dwa_medicare_saved_facilities";

function getSaved(): string[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
}
function setSaved(names: string[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(names));
}

export default function AdminMedicareIntel() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pitchTarget, setPitchTarget] = useState<Facility | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedNames, setSavedNames] = useState<string[]>(getSaved);
  const [marketLabel, setMarketLabel] = useState<string>("");
  // Market selectors — restored from localStorage
  const persisted = (() => { try { return JSON.parse(localStorage.getItem(MARKET_KEY) || "{}"); } catch { return {}; } })();
  const [stateCode, setStateCode] = useState<string>(persisted.state || "MI");
  const [metroId, setMetroId] = useState<string>(persisted.metro ?? "detroit");
  // Sort + filter UI state
  const [sortKey, setSortKey] = useState<SortKey>("staffing_rating");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [onlyOneStar, setOnlyOneStar] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem(MARKET_KEY, JSON.stringify({ state: stateCode, metro: metroId }));
  }, [stateCode, metroId]);

  // When state changes, reset metro to that state's first metro (or statewide)
  function handleStateChange(s: string) {
    setStateCode(s);
    const metros = STATE_METROS[s] || [];
    setMetroId(metros[0]?.id ?? "");
  }

  async function fetchData() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("medicare-staffing-intel", {
        body: { state: stateCode, metro: metroId || undefined },
      });
      if (error) throw error;
      const fetched: Facility[] = data?.facilities || [];
      setFacilities(fetched);
      setTotal(data?.total || 0);
      setMarketLabel(data?.metro_area || `${stateCode} statewide`);
      const names = [...new Set([...savedNames, ...fetched.map(f => f.provider_name)])];
      setSavedNames(names);
      setSaved(names);
      toast({ title: `Found ${data?.total || 0} understaffed facilities in ${data?.metro_area || stateCode}` });
    } catch (e) {
      toast({ title: "Error fetching Medicare data", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "provider_name" || key === "city" ? "asc" : "desc"); }
  }

  // Filter + sort pipeline
  const visibleFacilities = useMemo(() => {
    let out = facilities;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(f => f.provider_name.toLowerCase().includes(q) || (f.city || "").toLowerCase().includes(q));
    }
    if (onlyOneStar) out = out.filter(f => f.staffing_rating === 1);
    out = [...out].sort((a, b) => {
      const av = a[sortKey] ?? (typeof a[sortKey] === "string" ? "" : -1);
      const bv = b[sortKey] ?? (typeof b[sortKey] === "string" ? "" : -1);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [facilities, search, onlyOneStar, sortKey, sortDir]);

  function SortHeader({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "center" | "right" }) {
    const active = sortKey === k;
    return (
      <th className={`text-${align} py-2 px-3 cursor-pointer select-none hover:text-white/70`} onClick={() => toggleSort(k)}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
        </span>
      </th>
    );
  }

  function removeFacility(name: string) {
    const updated = savedNames.filter(n => n !== name);
    setSavedNames(updated);
    setSaved(updated);
    setFacilities(prev => prev.filter(f => f.provider_name !== name));
    toast({ title: `Removed "${name}" from your list` });
  }

  function ratingBadge(rating: number | null) {
    if (!rating) return <span className="text-white/30 text-xs">N/A</span>;
    const colors: Record<number, string> = {
      1: "bg-red-500/20 text-red-400 border-red-500/30",
      2: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      3: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      4: "bg-green-500/20 text-green-400 border-green-500/30",
      5: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${colors[rating] || "bg-white/10 text-white/50"}`}>
        {"★".repeat(rating)} {rating}/5
      </span>
    );
  }

  function whyFlagged(f: Facility): string {
    const reasons: string[] = [];
    if (f.staffing_rating && f.staffing_rating <= 2) {
      reasons.push(`${f.staffing_rating}-star staffing rating means they're critically understaffed — actively need nurses/CNAs`);
    }
    if (f.overall_rating && f.overall_rating <= 2) {
      reasons.push(`${f.overall_rating}-star overall CMS rating signals operational struggles, often tied to staffing shortages`);
    }
    if (f.number_of_beds && f.number_of_beds >= 100) {
      reasons.push(`${f.number_of_beds} beds = large facility with high staffing demand`);
    }
    if (f.rn_staffing_hours && f.rn_staffing_hours < 0.5) {
      reasons.push(`Low RN hours per resident/day (${f.rn_staffing_hours}) — below federal recommendation`);
    }
    return reasons.length > 0 ? reasons.join(". ") + "." : "Flagged by CMS Medicare Care Compare as a facility with staffing concerns.";
  }

  function generatePitch(f: Facility): string {
    return `Hi,

I noticed ${f.provider_name} (${f.city}, ${f.state}) currently has a ${f.staffing_rating || "low"}-star staffing rating on CMS Medicare Care Compare.${f.number_of_beds ? ` With ${f.number_of_beds} beds, staffing gaps can compound quickly.` : ""}

We specialize in connecting Michigan healthcare facilities with licensed CNAs, LPNs, and RNs who are actively seeking positions.

Our TechAlert system monitors new license issuances from LARA daily and delivers verified, actionable candidate profiles directly to your inbox — complete with contact information and license verification.

We've helped facilities like yours fill critical positions within 48 hours of alert delivery.

Would you have 10 minutes this week for a quick call?

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
    toast({ title: "Pitch copied to clipboard" });
  }

  function openEmail(f: Facility) {
    const subject = encodeURIComponent(`Staffing Support for ${f.provider_name}`);
    const body = encodeURIComponent(generatePitch(f));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function googleSearch(name: string, city: string) {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(name + " " + city + " nursing home")}`, "_blank");
  }

  function cmsLink(f: Facility) {
    window.open(`https://www.medicare.gov/care-compare/?providerType=NursingHome&redirect=true&searchCriteria=name&q=${encodeURIComponent(f.provider_name)}&state=${f.state}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white/40 text-xs uppercase tracking-wide mb-1">Medicare Care Compare</h2>
          <p className="text-white/60 text-sm">
            Nursing homes with 1-2 Star Staffing Ratings — prime TechAlert prospects.
          </p>
          <p className="text-white/30 text-xs mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" /> Facilities stay on your list until you remove them.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Scanning CMS..." : total > 0 ? "Refresh Data" : "Scan Medicare API"}
        </button>
      </div>

      {/* Market selectors — state + metro */}
      <div className="bg-[#0f1f35] border border-white/10 rounded-lg p-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-white/40 uppercase tracking-wide">State</label>
          <select
            value={stateCode}
            onChange={(e) => handleStateChange(e.target.value)}
            className="bg-[#0a1628] border border-white/10 text-white text-sm rounded px-2 py-1.5 min-w-[80px]"
          >
            {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-white/40 uppercase tracking-wide">Metro</label>
          <select
            value={metroId}
            onChange={(e) => setMetroId(e.target.value)}
            className="bg-[#0a1628] border border-white/10 text-white text-sm rounded px-2 py-1.5 min-w-[200px]"
          >
            <option value="">Statewide (all metros)</option>
            {(STATE_METROS[stateCode] || []).map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        {marketLabel && (
          <p className="text-white/40 text-xs ml-auto">
            Showing <strong className="text-white/70">{visibleFacilities.length}</strong> of {total} — {marketLabel}
            {!metroId && total >= 500 && <span className="block text-amber-400/70 text-[10px]">Capped at 500 — pick a metro for more.</span>}
          </p>
        )}
      </div>

      {/* Search + filter row */}
      {facilities.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by facility or city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0a1628] border border-white/10 text-white text-sm rounded pl-8 pr-3 py-1.5"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input type="checkbox" checked={onlyOneStar} onChange={(e) => setOnlyOneStar(e.target.checked)} />
            1-star only
          </label>
        </div>
      )}

      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0f1f35] border border-white/10 rounded-lg p-3">
            <p className="text-white/40 text-xs">Total Found</p>
            <p className="text-2xl font-bold text-white">{total}</p>
          </div>
          <div className="bg-[#0f1f35] border border-red-500/20 rounded-lg p-3">
            <p className="text-white/40 text-xs">1-Star Staffing</p>
            <p className="text-2xl font-bold text-red-400">{facilities.filter(f => f.staffing_rating === 1).length}</p>
          </div>
          <div className="bg-[#0f1f35] border border-orange-500/20 rounded-lg p-3">
            <p className="text-white/40 text-xs">2-Star Staffing</p>
            <p className="text-2xl font-bold text-orange-400">{facilities.filter(f => f.staffing_rating === 2).length}</p>
          </div>
          <div className="bg-[#0f1f35] border border-[#00d4ff]/20 rounded-lg p-3">
            <p className="text-white/40 text-xs">Avg Beds</p>
            <p className="text-2xl font-bold text-[#00d4ff]">
              {Math.round(facilities.reduce((s, f) => s + (f.number_of_beds || 0), 0) / (facilities.length || 1))}
            </p>
          </div>
        </div>
      )}

      {facilities.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase border-b border-white/10">
                <SortHeader k="provider_name" label="Facility" />
                <SortHeader k="city" label="City" />
                <SortHeader k="staffing_rating" label="Staffing" align="center" />
                <SortHeader k="overall_rating" label="Overall" align="center" />
                <SortHeader k="number_of_beds" label="Beds" align="center" />
                <th className="text-left py-2 px-3">Phone</th>
                <th className="text-right py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleFacilities.map((f, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => googleSearch(f.provider_name, f.city)}
                      className="text-white font-medium text-sm hover:text-[#00d4ff] transition-colors text-left cursor-pointer flex items-center gap-1"
                      title="Search on Google"
                    >
                      {f.provider_name}
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                    <p className="text-white/40 text-xs">{f.address}</p>
                    <button
                      onClick={() => cmsLink(f)}
                      className="text-[#00d4ff]/50 text-[10px] hover:text-[#00d4ff] transition-colors mt-0.5"
                    >
                      View on Medicare.gov →
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-white/60">{f.city}</td>
                  <td className="py-2.5 px-3 text-center">
                    <div>{ratingBadge(f.staffing_rating)}</div>
                    {f.staffing_rating && f.staffing_rating <= 2 && (
                      <span className="text-[9px] text-red-400/60 block mt-0.5">Understaffed</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">{ratingBadge(f.overall_rating)}</td>
                  <td className="py-2.5 px-3 text-center text-white/60">{f.number_of_beds || "—"}</td>
                  <td className="py-2.5 px-3">
                    {f.phone ? (
                      <a href={`tel:${f.phone}`} className="text-[#00d4ff]/80 hover:text-[#00d4ff] transition-colors">
                        {f.phone}
                      </a>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPitchTarget(f)}
                          className="px-3 py-1.5 rounded bg-[#00d4ff]/10 text-[#00d4ff] text-xs font-medium hover:bg-[#00d4ff]/20 transition-colors border border-[#00d4ff]/20"
                          data-testid={`pitch-btn-${i}`}
                        >
                          TechAlert Pitch
                        </button>
                        <button
                          onClick={() => removeFacility(f.provider_name)}
                          className="p-1.5 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove from list"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <IntelRowActions
                        companyName={f.provider_name}
                        phone={f.phone}
                        city={f.city}
                        state={f.state}
                        role="CNA / LPN / RN"
                        sourceLabel="medicare_care_compare"
                        score={f.staffing_rating === 1 ? 9 : f.staffing_rating === 2 ? 7 : 5}
                        notes={`CMS staffing rating: ${f.staffing_rating ?? "N/A"} | Beds: ${f.number_of_beds ?? "N/A"} | Address: ${f.address}`}
                        emailSubject={`Staffing Support for ${f.provider_name}`}
                        emailBody={generatePitch(f)}
                        compact
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* WHY THESE FACILITIES — explanation bar */}
          <div className="mt-4 bg-[#0f1f35] border border-white/10 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-[#00d4ff] shrink-0 mt-0.5" />
              <div>
                <p className="text-white/70 text-xs font-semibold mb-1">Why are these facilities on this list?</p>
                <p className="text-white/40 text-xs leading-relaxed">
                  These nursing homes have <strong className="text-red-400">1-2 star staffing ratings</strong> on CMS Medicare Care Compare — a federal database tracking every nursing home in the US. Low staffing ratings mean they're <strong className="text-white/60">critically short on nurses and CNAs</strong>, making them ideal prospects for TechAlert's licensed healthcare candidate alerts. Facilities with more beds and lower ratings are the highest-priority targets.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && facilities.length === 0 && total === 0 && (
        <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/40 text-sm">Click "Scan Medicare API" to find understaffed nursing homes in Metro Detroit.</p>
          <p className="text-white/30 text-xs mt-2">Data source: CMS Medicare Care Compare (free, public, federal)</p>
        </div>
      )}

      {/* ── PITCH MODAL ─────────────────────────────────────────────── */}
      {pitchTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPitchTarget(null)}>
          <div
            className="bg-[#0f1f35] border border-white/10 rounded-xl max-w-lg w-full max-h-[80vh] overflow-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h3 className="text-white font-bold text-sm">TechAlert Pitch</h3>
                <p className="text-white/40 text-xs">{pitchTarget.provider_name}</p>
              </div>
              <button onClick={() => setPitchTarget(null)} className="text-white/30 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Why this facility */}
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-1">Why pitch this facility</p>
              <p className="text-white/50 text-xs leading-relaxed">{whyFlagged(pitchTarget)}</p>
            </div>

            <div className="p-4">
              <pre className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-black/20 rounded-lg p-4 border border-white/5">
                {generatePitch(pitchTarget)}
              </pre>
            </div>

            <div className="flex items-center gap-2 p-4 border-t border-white/10">
              <button
                onClick={() => copyPitch(generatePitch(pitchTarget))}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 transition-colors text-sm font-medium"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Pitch"}
              </button>
              <button
                onClick={() => openEmail(pitchTarget)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium"
              >
                <Mail className="w-4 h-4" /> Open in Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
