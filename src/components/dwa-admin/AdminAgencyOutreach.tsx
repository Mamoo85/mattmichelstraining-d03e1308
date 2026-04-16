import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, Wand2, Mail } from "lucide-react";

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

  useEffect(() => { loadCandidates(); }, []);

  const loadCandidates = async () => {
    setLoadingCands(true);
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from("hire_alert_candidates")
      .select("id, name, role, county, score, created_at")
      .gte("created_at", since)
      .order("score", { ascending: false })
      .limit(10);
    setCandidates(data || []);
    setLoadingCands(false);
  };

  const draftEmail = async (agency: typeof METRO_DETROIT_AGENCIES[0]) => {
    setDrafting(agency.name);
    try {
      const matchingCands = candidates
        .filter(c => {
          const r = (c.role || "").toLowerCase();
          const isHC = /\b(rn|lpn|cna|nurse|home\s*health|aide)\b/.test(r);
          const isInd = /\b(boiler|hvac|electric|plumb|stationary|engineer|machinist)\b/.test(r);
          return agency.vertical === "healthcare" ? isHC : isInd;
        })
        .slice(0, 3)
        .map(c => ({
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
        },
      });
      if (error) throw error;
      setDrafts(d => ({ ...d, [agency.name]: data?.draft || "" }));
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
              <button
                onClick={() => draftEmail(agency)}
                disabled={drafting === agency.name}
                className="px-4 py-2 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/20 transition-colors text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {drafting === agency.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Draft with Opus
              </button>
            </div>
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
