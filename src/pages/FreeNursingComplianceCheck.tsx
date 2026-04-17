import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, AlertTriangle, CheckCircle, Shield, ArrowRight, Loader2, Plus, X } from "lucide-react";
import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

export default function FreeNursingComplianceCheck() {
  
  useDwaDomainRedirect();
  const [licenses, setLicenses] = useState<string[]>([""]);
  const [state, setState] = useState("Michigan");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const addLicense = () => { if (licenses.length < 5) setLicenses([...licenses, ""]); };
  const removeLicense = (i: number) => setLicenses(licenses.filter((_, idx) => idx !== i));
  const updateLicense = (i: number, v: string) => { const n = [...licenses]; n[i] = v; setLicenses(n); };

  const handleScan = async () => {
    const valid = licenses.filter(l => l.trim());
    if (!valid.length) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("nursing-compliance-check", {
        body: { license_numbers: valid, state, email: email || undefined },
      });
      if (fnErr) throw fnErr;
      if (data?.success) setResults(data);
      else setError(data?.error || "Check failed");
    } catch {
      setError("Check failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const flagColors: Record<string, string> = {
    Critical: "text-red-500 bg-red-500/10",
    Warning: "text-amber-400 bg-amber-500/10",
    Clear: "text-emerald-400 bg-emerald-500/10",
  };

  return (
    <>
      <SEOHead title="Free Nursing License Compliance Check | Detroit Web Agency" description="Check up to 5 nurse license numbers for expirations, disciplinary actions, and compliance risks — free, instant." path="/free-tools/nursing-compliance" />
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Link to="/free-tools" className="text-cyan-400 text-xs font-mono hover:underline mb-6 inline-block">← All Free Tools</Link>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 text-pink-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4">
              <Stethoscope size={12} /> Compliance Check
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">Nursing License Compliance Blindspot Check</h1>
            <p className="text-[#888] max-w-xl mx-auto text-sm">Enter up to 5 nurse license numbers to check for expirations, revocations, and disciplinary actions.</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            {licenses.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder={`License #${i + 1}`} value={l} onChange={e => updateLicense(i, e.target.value)} className="flex-1 bg-white/5 border-white/10" />
                {licenses.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeLicense(i)} className="text-[#666] hover:text-red-400">
                    <X size={16} />
                  </Button>
                )}
              </div>
            ))}
            {licenses.length < 5 && (
              <Button variant="ghost" onClick={addLicense} className="text-cyan-400 text-xs">
                <Plus size={14} className="mr-1" /> Add License
              </Button>
            )}
            <Input placeholder="State (default: Michigan)" value={state} onChange={e => setState(e.target.value)} className="bg-white/5 border-white/10" />
            <Input type="email" placeholder="Your email (optional)" value={email} onChange={e => setEmail(e.target.value)} className="bg-white/5 border-white/10" />
            <Button onClick={handleScan} disabled={loading || !licenses.some(l => l.trim())} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold">
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Checking licenses (30-60s)...</> : "Run Compliance Check"}
            </Button>
          </div>

          {error && <p className="text-red-400 text-sm text-center mb-6">{error}</p>}

          {results && (
            <div className="space-y-4">
              <div className={`rounded-2xl p-6 text-center border ${results.overall_risk === "Critical" ? "bg-red-500/5 border-red-500/20" : results.overall_risk === "Warning" ? "bg-amber-500/5 border-amber-500/20" : "bg-emerald-500/5 border-emerald-500/20"}`}>
                {results.overall_risk === "Clear" ? (
                  <CheckCircle className="text-emerald-400 mx-auto mb-2" size={32} />
                ) : (
                  <AlertTriangle className={results.overall_risk === "Critical" ? "text-red-500 mx-auto mb-2" : "text-amber-400 mx-auto mb-2"} size={32} />
                )}
                <p className="text-xl font-black">Overall: {results.overall_risk}</p>
              </div>

              {results.summary && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <p className="text-sm text-[#ccc]">{results.summary}</p>
                </div>
              )}

              {results.results?.map((r: any, i: number) => (
                <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-sm">License #{r.license_number}</p>
                      {r.holder_name && <p className="text-xs text-[#888]">{r.holder_name} • {r.license_type || "Unknown"}</p>}
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${flagColors[r.risk_flag] || flagColors.Clear}`}>
                      {r.risk_flag || "Unknown"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[#666]">Status:</span> <span className={r.status === "Active" ? "text-emerald-400" : "text-red-400"}>{r.status}</span></div>
                    <div><span className="text-[#666]">Expires:</span> {r.expiration_date || "Unknown"}</div>
                  </div>
                  {r.disciplinary_actions?.length > 0 && (
                    <div className="mt-2 bg-red-500/5 rounded-lg p-2">
                      <p className="text-[10px] text-red-400 font-bold uppercase mb-1">Disciplinary Actions</p>
                      {r.disciplinary_actions.map((d: any, j: number) => (
                        <p key={j} className="text-xs text-[#888]">{d.date}: {d.action}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {results.overall_risk !== "Clear" && (
                <div className="bg-cyan-500/5 border border-cyan-400/20 rounded-2xl p-6 text-center">
                  <Shield className="text-cyan-400 mx-auto mb-2" size={20} />
                  <p className="text-sm font-bold mb-2">Don't monitor 150+ licenses manually.</p>
                  <p className="text-xs text-[#888] mb-3">Our automated Compliance Dashboard tracks every nurse's license 24/7 and alerts you before problems become lawsuits.</p>
                  <Link to="/hire-alert" className="inline-flex items-center gap-2 text-cyan-400 font-bold text-sm hover:underline">
                    Get Automated Monitoring <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-[#444] mt-8">Data sources: LARA, Nursys, state boards • Generated by Detroit Web Agency</p>
        </div>
      </div>
    </>
  );
}
