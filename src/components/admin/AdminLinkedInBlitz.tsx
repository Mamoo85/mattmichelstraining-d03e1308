// Channel 2 — LinkedIn DM blitz. Generates personalized DM copy from Growth Signals.
// Manual send only (Matt copies into LinkedIn web). No automation, no API key.
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Linkedin, Copy, RefreshCw, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";

interface Signal {
  id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  hiring_roles: string[];
  hiring_count: number;
  predicted_needs: string[];
  confidence: number;
}

const TEMPLATES = [
  (s: Signal) => `Hey — quick one. Saw ${s.company_name} just posted ${s.hiring_count} ${s.hiring_roles[0] || "openings"} in ${s.location || "Metro Detroit"}. That kind of hiring usually means a spend cycle on ${s.predicted_needs[0] || "equipment"} is incoming. I track Detroit-area manufacturers right at this moment — found 42 of these this week. Free sample dossier if you want it?`,
  (s: Signal) => `Hi [Name] — built a tool that watches Metro Detroit manufacturers the moment they start hiring (= about to spend on consumables/equipment). ${s.company_name} just hit my radar (${s.hiring_count} ${s.hiring_roles[0] || "roles"}). Worth a 2-min look? Happy to send the dossier free.`,
  (s: Signal) => `Quick value drop: ${s.company_name} (${s.location || "MI"}) just posted ${s.hiring_count} ${s.hiring_roles[0] || "positions"}. My scanner predicts they'll need ${s.predicted_needs.slice(0, 2).join(" + ") || "supplies"} in the next 30-60 days. Want the full intel packet? Free, takes me 5 min.`,
];

export default function AdminLinkedInBlitz() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [variant, setVariant] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verticalFilter, setVerticalFilter] = useState<string>("All");

  useEffect(() => { fetchSignals(); }, []);

  async function fetchSignals() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("industry_pulse_signals")
      .select("id,company_name,location,industry,hiring_roles,hiring_count,predicted_needs,confidence")
      .gte("confidence", 6)
      .order("confidence", { ascending: false })
      .order("detected_at", { ascending: false })
      .limit(40);
    setSignals(data || []);
    setLoading(false);
  }

  const verticals = useMemo(() => {
    const set = new Set<string>(["All"]);
    signals.forEach(s => s.industry && set.add(s.industry));
    return Array.from(set);
  }, [signals]);

  const filtered = useMemo(() => verticalFilter === "All" ? signals : signals.filter(s => s.industry === verticalFilter), [signals, verticalFilter]);

  function copyDM(s: Signal) {
    const dm = TEMPLATES[variant](s);
    navigator.clipboard.writeText(dm);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("DM copied — paste into LinkedIn");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-[#0a66c2]" /> LinkedIn Blitz
          </h2>
          <p className="text-white/40 text-xs mt-1">Personalized DMs to ops directors at industrial distributors. Manual send only — paste into LinkedIn web.</p>
        </div>
        <Button size="sm" onClick={fetchSignals} disabled={loading} className="bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      <Card className="bg-[#0f1f35] border-white/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/40 text-xs">Template:</span>
            {[0, 1, 2].map(i => (
              <Button
                key={i}
                size="sm"
                onClick={() => setVariant(i)}
                className={variant === i ? "bg-[#00d4ff] text-black" : "bg-white/5 text-white/50 border border-white/10"}
              >
                Variant {String.fromCharCode(65 + i)}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/40 text-xs">Vertical:</span>
            {verticals.map(v => (
              <Button
                key={v}
                size="sm"
                onClick={() => setVerticalFilter(v)}
                className={verticalFilter === v ? "bg-white/10 text-white text-xs" : "bg-white/5 text-white/40 border border-white/10 text-xs"}
              >
                {v}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0f1f35] border-white/10"><CardContent className="py-10 text-center text-white/40 text-sm">No high-confidence signals match.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <Card key={s.id} className="bg-[#0f1f35] border-white/10">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm">{s.company_name}</p>
                    <p className="text-white/40 text-xs">{s.location || "MI"} · {s.industry || "Industrial"} · {s.hiring_count}× {s.hiring_roles.slice(0, 2).join(", ")}</p>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] shrink-0">{s.confidence}/10</Badge>
                </div>
                <div className="bg-black/30 border border-white/5 rounded p-3 text-white/70 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                  {TEMPLATES[variant](s)}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => copyDM(s)}
                    className="bg-[#0a66c2]/20 text-[#0a66c2] border border-[#0a66c2]/40 hover:bg-[#0a66c2]/30"
                  >
                    {copiedId === s.id ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copiedId === s.id ? "Copied!" : "Copy DM"}
                  </Button>
                  <a
                    href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(s.company_name + " operations director")}`}
                    target="_blank" rel="noreferrer"
                    className="text-xs text-[#0a66c2] hover:underline flex items-center gap-1"
                  >
                    Find decision-maker on LinkedIn <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
