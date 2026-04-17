import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, AlertTriangle, Clock, ArrowRight, Loader2 } from "lucide-react";
import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

export default function FreeEquipmentAgeCheck() {
  
  useDwaDomainRedirect();
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const handleScan = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("equipment-age-check", {
        body: { address, email: email || undefined },
      });
      if (fnErr) throw fnErr;
      if (data?.success) setResults(data);
      else setError(data?.error || "Scan failed");
    } catch {
      setError("Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const urgencyColors: Record<string, string> = {
    Overdue: "text-red-500 bg-red-500/10",
    "Due Soon": "text-amber-400 bg-amber-500/10",
    OK: "text-emerald-400 bg-emerald-500/10",
  };

  return (
    <>
      <SEOHead title="Free Equipment Age Estimator | Detroit Web Agency" description="Estimate the age and replacement timeline of your facility's HVAC, boiler, and roofing systems — free public records search." path="/free-tools/equipment-age" />
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Link to="/free-tools" className="text-cyan-400 text-xs font-mono hover:underline mb-6 inline-block">← All Free Tools</Link>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4">
              <Wrench size={12} /> Equipment Age Check
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">How Old Is Your Building's Equipment?</h1>
            <p className="text-[#888] max-w-xl mx-auto text-sm">We search public building permits to estimate when your HVAC, boiler, and roof were last replaced.</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <Input placeholder="Facility address or property name" value={address} onChange={e => setAddress(e.target.value)} className="bg-white/5 border-white/10" />
            <Input type="email" placeholder="Your email (optional)" value={email} onChange={e => setEmail(e.target.value)} className="bg-white/5 border-white/10" />
            <Button onClick={handleScan} disabled={loading || !address.trim()} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold">
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Searching permit records...</> : "Check Equipment Age"}
            </Button>
          </div>

          {error && <p className="text-red-400 text-sm text-center mb-6">{error}</p>}

          {results && (
            <div className="space-y-4">
              <div className={`rounded-2xl p-6 text-center border ${results.overall_risk === "Critical" || results.overall_risk === "High" ? "bg-red-500/5 border-red-500/20" : "bg-white/[0.03] border-white/10"}`}>
                <Wrench className="text-cyan-400 mx-auto mb-2" size={28} />
                {results.year_built && <p className="text-sm text-[#888] mb-1">Building Year: {results.year_built}</p>}
                <p className="text-xl font-black">Overall Risk: <span className={results.overall_risk === "Critical" ? "text-red-500" : results.overall_risk === "High" ? "text-orange-500" : "text-emerald-400"}>{results.overall_risk || "Unknown"}</span></p>
                {results.estimated_replacement_cost && <p className="text-sm text-[#888] mt-1">Est. replacement: {results.estimated_replacement_cost}</p>}
              </div>

              {results.summary && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <p className="text-sm text-[#ccc]">{results.summary}</p>
                </div>
              )}

              {results.equipment_records?.length > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-[#aaa] uppercase tracking-widest mb-4">Equipment Records</h3>
                  <div className="space-y-3">
                    {results.equipment_records.map((r: any, i: number) => (
                      <div key={i} className="bg-white/[0.02] rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">{r.system}</p>
                          <p className="text-xs text-[#888]">Last permit: {r.last_permit_date || "Unknown"} • ~{r.estimated_age_years || "?"} years old</p>
                          <p className="text-xs text-[#666]">Typical lifespan: {r.typical_lifespan_years || "?"} years</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${urgencyColors[r.replacement_urgency] || "text-[#888] bg-white/5"}`}>
                            <Clock size={10} className="inline mr-1" />{r.replacement_urgency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(results.overall_risk === "Critical" || results.overall_risk === "High") && (
                <div className="bg-cyan-500/5 border border-cyan-400/20 rounded-2xl p-6 text-center">
                  <AlertTriangle className="text-amber-400 mx-auto mb-2" size={20} />
                  <p className="text-sm font-bold mb-2">Your equipment may be past its operational lifespan.</p>
                  <p className="text-xs text-[#888] mb-3">Connect with our commercial equipment partner for an efficiency upgrade quote.</p>
                  <Link to="/agency" className="inline-flex items-center gap-2 text-cyan-400 font-bold text-sm hover:underline">
                    Get an Equipment Quote <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-[#444] mt-8">Data source: Public building permits • Generated by Detroit Web Agency</p>
        </div>
      </div>
    </>
  );
}
