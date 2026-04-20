import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, Wand2, Mail, Target, X, CheckCircle2 } from "lucide-react";

const METRO_DETROIT_AGENCIES = [
  { name: "Aerotek", contact: "Director of Recruiting", vertical: "industrial", note: "Largest skilled trades staffing in MI" },
  { name: "Kelly Industrial", contact: "VP of Recruiting", vertical: "industrial", note: "Manufacturing + skilled trades focus" },
  { name: "Express Employment Pros — Troy", contact: "Branch Manager", vertical: "industrial", note: "High-volume CNC/machinist placements" },
  { name: "Manpower Detroit", contact: "Director of Operations", vertical: "industrial", note: "Industrial + healthcare verticals" },
  { name: "PrideStaff Detroit", contact: "Strategic Partner", vertical: "industrial", note: "Mid-market skilled trades" },
  { name: "Maxim Healthcare Staffing", contact: "Director of Recruiting", vertical: "healthcare", note: "RN/CNA/LPN focus, Metro Detroit" },
  { name: "Cross Country Healthcare", contact: "Regional Director", vertical: "healthcare", note: "Travel + perm placements MI" },
  { name: "Favorite Healthcare Staffing", contact: "Branch Director", vertical: "healthcare", note: "LTC + skilled nursing focus" },
];

export default function AdminAgencyOutreach() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingCands, setLoadingCands] = useState(true);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Cherry-pick: agency.name -> candidate.id
  const [pickedFor, setPickedFor] = useState<Record<string, string | null>>({});
  const [showPicker, setShowPicker] = useState<string | null>(null);

  useEffect(() => { loadCandidates(); }, []);

  const loadCandidates = async () => {
    setLoadingCands(true);
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from("hire_alert_candidates")
      .select("id, name, full_name, trade, city, metro, score, current_title, qualifications_summary, created_at")
      .eq("is_company_name", false)
      .eq("do_not_contact", false)
      .gte("created_at", since)
      .order("score", { ascending: false })
      .limit(200);
    setCandidates(data || []);
    setLoadingCands(false);
  };

  const HC_TRADES = new Set(["nursing", "home_health"]);
  const IND_TRADES = new Set(["boiler", "hvac", "electrical", "plumbing", "other_trade"]);
  const HC_RX = /\b(rn|lpn|cna|nurse|nursing|aide|home\s*health|caregiver|medical|clinical|therapist|hha)\b/;
  const IND_RX = /\b(boiler|hvac|electric|plumb|stationary|engineer|machinist|operator|tech|welder|mechanic|fitter|pipefitter|fabricat|cnc|industrial)\b/;

  const matchingCandidatesFor = (vertical: "industrial" | "healthcare") =>
    candidates.filter(c => {
      const title = `${c.current_title || ""} ${c.trade || ""}`.toLowerCase();
      const trade = (c.trade || "").toLowerCase();
      if (vertical === "healthcare") return HC_TRADES.has(trade) || HC_RX.test(title);
      return IND_TRADES.has(trade) || IND_RX.test(title);
    });

  const draftEmail = async (agency: typeof METRO_DETROIT_AGENCIES[0]) => {
    setDrafting(agency.name);
    try {
      const pickedId = pickedFor[agency.name];
      const matchPool = matchingCandidatesFor(agency.vertical as any);
      const cherryPicked = pickedId ? matchPool.filter(c => c.id === pickedId) : [];
      const restMatches = matchPool.filter(c => c.id !== pickedId).slice(0, 2);
      const finalList = [...cherryPicked, ...restMatches].slice(0, 3);

      const matchingCands = finalList.map(c => ({
        name: c.name,
        licensed_role: c.role,
        county: c.county,
        signal_strength: c.score >= 8 ? "exceptional" : c.score >= 6 ? "strong" : "moderate",
      }));

      const { data, error } = await supabase.functions.invoke("agency-outreach-draft", {
        body: {
          agency_name: agency.name,
          contact_name: agency.contact,
          vertical: agency.vertical,
          recent_candidates: matchingCands,
          cherry_picked: !!pickedId,
        },
      });
      if (error) throw error;
      setDrafts(d => ({ ...d, [agency.name]: data?.draft || "" }));
      toast.success(pickedId ? "Cherry-picked draft ready" : "Draft ready");
    } catch (e: any) {
      toast.error(e?.message || "Draft failed");
    } finally {
      setDrafting(null);
    }
  };

  const copyDraft = (agencyName: string) => {
    navigator.clipboard.writeText(drafts[agencyName] || "");
    toast.success("Copied — paste in your email client");
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
        <h3 className="text-white font-bold text-lg mb-2">🎯 Trojan Horse Outreach (Opus-drafted)</h3>
        <p className="text-slate-400 text-sm mb-3">
          Generates personalized "free candidate" pitches for Metro Detroit staffing agencies. Copy → paste in your email from <code className="text-[#00d4ff]">matt@detroitwebagent.com</code>. <strong className="text-amber-300">TCPA-safe: never auto-sends.</strong>
        </p>
        <p className="text-slate-500 text-xs">
          Last 24h: {loadingCands ? "loading..." : `${candidates.length} candidates available for matching`}
        </p>
      </div>

      <div className="grid gap-4">
        {METRO_DETROIT_AGENCIES.map(agency => (
          <div key={agency.name} className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-bold">{agency.name}</h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${agency.vertical === "healthcare" ? "bg-pink-500/20 text-pink-300" : "bg-[#00d4ff]/20 text-[#00d4ff]"}`}>
                    {agency.vertical}
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-0.5">{agency.contact} · {agency.note}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => setShowPicker(showPicker === agency.name ? null : agency.name)}
                  className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                    pickedFor[agency.name]
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                      : "bg-[#0a1628] border-white/10 text-slate-400 hover:border-amber-500/40 hover:text-amber-300"
                  }`}
                  title="Cherry-pick the strongest candidate before drafting"
                >
                  <Target className="w-3 h-3" />
                  {pickedFor[agency.name] ? "Cherry-picked ✓" : "Cherry-Pick"}
                </button>
                <button
                  onClick={() => draftEmail(agency)}
                  disabled={drafting === agency.name}
                  className="px-4 py-2 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/20 transition-colors text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {drafting === agency.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  Draft with Opus
                </button>
              </div>
            </div>

            {/* Cherry-pick candidate selector */}
            {showPicker === agency.name && (
              <div className="mt-3 bg-[#0a1628] border border-amber-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-amber-300 text-xs uppercase tracking-wider font-bold flex items-center gap-1.5">
                      <Target className="w-3 h-3" /> Cherry-Pick Proof Candidate
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">Pick the strongest match. The first impression decides if they pay $250.</p>
                  </div>
                  <button onClick={() => setShowPicker(null)} className="text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {matchingCandidatesFor(agency.vertical as any).length === 0 && (
                    <p className="text-slate-500 text-xs text-center py-4">No matching candidates in last 7 days. Run scanner first.</p>
                  )}
                  {matchingCandidatesFor(agency.vertical as any).map(c => {
                    const isPicked = pickedFor[agency.name] === c.id;
                    const tier = c.score >= 8 ? "exceptional" : c.score >= 6 ? "strong" : "moderate";
                    const tierColor = c.score >= 8 ? "text-emerald-300" : c.score >= 6 ? "text-[#00d4ff]" : "text-slate-400";
                    return (
                      <button
                        key={c.id}
                        onClick={() => setPickedFor(p => ({ ...p, [agency.name]: isPicked ? null : c.id }))}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                          isPicked
                            ? "bg-amber-500/10 border-amber-500/40"
                            : "bg-[#0f1f35] border-white/5 hover:border-amber-500/30"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-white font-semibold truncate">{c.name || "(unnamed)"}</div>
                          <div className="text-slate-500 text-[11px] truncate">{c.role} · {c.county || "—"}</div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className={`text-[10px] uppercase tracking-wider font-bold ${tierColor}`}>{tier}</span>
                          {isPicked && <CheckCircle2 className="w-4 h-4 text-amber-300" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {drafts[agency.name] && (
              <div className="mt-4 bg-[#0a1628] border border-white/10 rounded-lg p-4">
                <pre className="text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">{drafts[agency.name]}</pre>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => copyDraft(agency.name)} className="px-3 py-1.5 rounded bg-[#00d4ff] text-[#0a1628] text-xs font-bold flex items-center gap-1.5">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(drafts[agency.name].split("\n")[0].replace(/^SUBJECT:\s*/i, ""))}&body=${encodeURIComponent(drafts[agency.name])}`}
                    className="px-3 py-1.5 rounded border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:border-[#00d4ff]/40"
                  >
                    <Mail className="w-3 h-3" /> Open in mail
                  </a>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
