import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Radar, Download, CheckCircle2, Loader2, Factory, TrendingUp } from "lucide-react";

const STEEL_DEMO_TOKEN = "STEEL_DEMO";
const DWA_DEMO_TOKEN = "DWA_DEMO_MASTER";

const DEMO_SIGNALS = [
  {
    id: "demo-1", company_name: "Detroit Metalworks Inc",
    county: "Wayne", location: "Detroit, MI",
    expansion_type: "Contract Award", confidence: 9,
    predicted_needs: ["Structural beams", "Steel plate", "Hot-rolled coil"],
    recommended_pitch: "Awarded 5-year fabrication contract for automotive frame assemblies. Will need 200+ tons of structural steel monthly starting Q2.",
    detected_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: "demo-2", company_name: "Midwest Precision Parts",
    county: "Oakland", location: "Troy, MI",
    expansion_type: "Workforce Expansion", confidence: 8,
    predicted_needs: ["CNC tooling steel", "Bar stock", "Sheet metal"],
    recommended_pitch: "Posted 3 CNC operator + 2 machinist jobs this week. Expanding fabrication capacity.",
    detected_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
  },
  {
    id: "demo-3", company_name: "Great Lakes Industrial",
    county: "Macomb", location: "Warren, MI",
    expansion_type: "Equipment Acquisition", confidence: 9,
    predicted_needs: ["Press brake stock", "Plate steel", "Structural channel"],
    recommended_pitch: "Filed $2.1M permit for new press brake + 15,000 sqft facility expansion.",
    detected_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
  },
];

interface Signal {
  id: string;
  company_name: string;
  county: string | null;
  location: string | null;
  expansion_type: string | null;
  confidence: number;
  predicted_needs: string[] | null;
  recommended_pitch: string | null;
  detected_at: string;
}

export default function DemandRadarPortal() {
  const [params] = useSearchParams();
  const token = params.get("token") || params.get("id") || "";
  const isDemo = token === STEEL_DEMO_TOKEN || token === DWA_DEMO_TOKEN;
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<{ company_name: string; vertical?: string } | null>(null);
  const [contacted, setContacted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isDemo) {
      setSignals(DEMO_SIGNALS);
      setClient({ company_name: "Ameristeel (Demo)", vertical: "steel" });
      setLoading(false);
      return;
    }
    if (!token) { setLoading(false); return; }
    (async () => {
      const { data: c } = await supabase
        .from("industry_pulse_clients")
        .select("id, company_name, vertical, target_industries, territory_counties")
        .eq("dashboard_token", token).maybeSingle();
      if (!c) { toast.error("Invalid access token"); setLoading(false); return; }
      setClient({ company_name: c.company_name || "", vertical: c.vertical });
      const sinceISO = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      const { data: sigs = [] } = await supabase
        .from("industry_pulse_signals")
        .select("id, company_name, county, location, expansion_type, confidence, predicted_needs, recommended_pitch, detected_at")
        .gte("detected_at", sinceISO)
        .gte("confidence", 6)
        .order("confidence", { ascending: false })
        .limit(50);
      setSignals((sigs || []) as Signal[]);
      setLoading(false);
    })();
  }, [token, isDemo]);

  const markContacted = (id: string) => {
    setContacted((s) => new Set(s).add(id));
    toast.success("Marked as contacted");
  };

  const exportCSV = () => {
    const rows = [
      ["Signal ID", "Company", "County", "Type", "Confidence", "Predicted Needs", "Detected"],
      ...signals.map((s) => [
        s.id, s.company_name, s.county || "", s.expansion_type || "",
        String(s.confidence), (s.predicted_needs || []).join("; "),
        new Date(s.detected_at).toISOString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `demand-radar-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <SEOHead title="Demand Radar Portal | Detroit Web Agency" description="Live expansion signals for your sales territory" path="/demand-radar-portal" />
      <div className="min-h-screen bg-[#0a1628] text-white" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Radar className="w-5 h-5 text-[#00d4ff]" />
                <span className="text-[#00d4ff] text-xs uppercase tracking-widest font-bold">Demand Radar</span>
                {isDemo && <span className="bg-amber-500 text-black text-xs px-2 py-0.5 rounded font-bold">DEMO</span>}
              </div>
              <h1 className="text-2xl font-semibold">{client?.company_name || "Your Territory"}</h1>
              <p className="text-white/50 text-sm mt-1">{signals.length} expansion {signals.length === 1 ? "signal" : "signals"} in last 7 days</p>
            </div>
            <Button onClick={exportCSV} variant="outline" className="bg-white/5 border-white/20 hover:bg-white/10">
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#00d4ff]" /></div>
          ) : !signals.length ? (
            <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-10 text-center">
              <Factory className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/60">No new signals in the last 7 days. Check back tomorrow at 7am.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {signals.map((s) => {
                const conf = s.confidence;
                const confColor = conf >= 8 ? "bg-emerald-500" : conf >= 6 ? "bg-amber-500" : "bg-slate-500";
                const isContacted = contacted.has(s.id);
                return (
                  <div key={s.id} className={`bg-[#0f1f35] border rounded-xl p-5 transition ${isContacted ? "border-emerald-500/40 opacity-60" : "border-white/10 hover:border-[#00d4ff]/30"}`}>
                    <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                      <div>
                        <div className="text-lg font-semibold flex items-center gap-2">
                          {s.company_name}
                          {isContacted && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <div className="text-white/50 text-sm mt-0.5">
                          {s.county || s.location || "Metro Detroit"} · {s.expansion_type || "Expansion"}
                        </div>
                      </div>
                      <span className={`${confColor} text-black text-xs font-bold px-2 py-1 rounded`}>CONF {conf}/10</span>
                    </div>
                    {s.recommended_pitch && (
                      <p className="text-white/70 text-sm mt-2 leading-relaxed">{s.recommended_pitch}</p>
                    )}
                    {s.predicted_needs?.length ? (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <TrendingUp className="w-3.5 h-3.5 text-[#00d4ff]" />
                        <span className="text-[#00d4ff] text-xs">Predicted needs:</span>
                        {s.predicted_needs.slice(0, 4).map((n, i) => (
                          <span key={i} className="text-xs bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20 px-2 py-0.5 rounded">{n}</span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" variant="ghost" disabled={isContacted}
                        onClick={() => markContacted(s.id)}
                        className="text-[#00d4ff] hover:bg-[#00d4ff]/10">
                        {isContacted ? "✓ Contacted" : "Mark Contacted"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-10 text-center text-white/30 text-xs">
            Detroit Web Agency · Demand Radar · Signals refreshed daily at 6am ET
          </div>
        </div>
      </div>
    </>
  );
}
