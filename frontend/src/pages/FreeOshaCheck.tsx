import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { HardHat, AlertTriangle, CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

export default function FreeOshaCheck() {
  
  useDwaDomainRedirect();
  const [companyName, setCompanyName] = useState("");
  const [state, setState] = useState("Michigan");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const handleScan = async () => {
    if (!companyName.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("osha-safety-check", {
        body: { company_name: companyName, state, email: email || undefined },
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

  const riskColors: Record<string, string> = {
    Critical: "text-red-500",
    High: "text-orange-500",
    Moderate: "text-amber-400",
    Low: "text-yellow-300",
    Clean: "text-emerald-400",
  };

  return (
    <>
      <SEOHead title="Free OSHA Safety Violation Check | Detroit Web Agency" description="Pull OSHA and MIOSHA safety violations for any company — free, instant public records search." path="/free-tools/osha-check" />
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Link to="/free-tools" className="text-cyan-400 text-xs font-mono hover:underline mb-6 inline-block">← All Free Tools</Link>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4">
              <HardHat size={12} /> OSHA Safety Check
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">OSHA & MIOSHA Violation Search</h1>
            <p className="text-[#888] max-w-xl mx-auto text-sm">Search public federal and state safety databases for citations, fines, and workplace incidents.</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Company name" value={companyName} onChange={e => setCompanyName(e.target.value)} className="bg-white/5 border-white/10" />
              <Input placeholder="State (default: Michigan)" value={state} onChange={e => setState(e.target.value)} className="bg-white/5 border-white/10" />
            </div>
            <Input type="email" placeholder="Your email (optional)" value={email} onChange={e => setEmail(e.target.value)} className="bg-white/5 border-white/10" />
            <Button onClick={handleScan} disabled={loading || !companyName.trim()} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold">
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Searching OSHA records...</> : "Run Safety Check"}
            </Button>
          </div>

          {error && <p className="text-red-400 text-sm text-center mb-6">{error}</p>}

          {results && (
            <div className="space-y-4">
              <div className={`rounded-2xl p-6 text-center border ${results.violations_found ? "bg-red-500/5 border-red-500/20" : "bg-emerald-500/5 border-emerald-500/20"}`}>
                {results.violations_found ? (
                  <AlertTriangle className="text-red-500 mx-auto mb-2" size={32} />
                ) : (
                  <CheckCircle className="text-emerald-400 mx-auto mb-2" size={32} />
                )}
                <p className="text-xl font-black mb-1">
                  Risk Level: <span className={riskColors[results.risk_level] || ""}>{results.risk_level}</span>
                </p>
                {results.total_penalties && <p className="text-sm text-[#888]">Total penalties: {results.total_penalties}</p>}
              </div>

              {results.summary && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <p className="text-sm text-[#ccc]">{results.summary}</p>
                </div>
              )}

              {results.violations?.length > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-[#aaa] uppercase tracking-widest mb-4">Violations on Record</h3>
                  <div className="space-y-3">
                    {results.violations.map((v: any, i: number) => (
                      <div key={i} className="bg-white/[0.02] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm">{v.type}</span>
                          <span className="text-xs text-[#666]">{v.date} • {v.severity}</span>
                        </div>
                        <p className="text-xs text-[#888]">{v.description}</p>
                        {v.penalty_amount && <p className="text-xs text-red-400 mt-1">Penalty: {v.penalty_amount}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.violations_found && (
                <div className="bg-cyan-500/5 border border-cyan-400/20 rounded-2xl p-6 text-center">
                  <p className="text-sm font-bold mb-2">Safety violations = equipment liability.</p>
                  <p className="text-xs text-[#888] mb-3">Connect with our industrial maintenance partner for a preventative equipment audit.</p>
                  <Link to="/agency" className="inline-flex items-center gap-2 text-cyan-400 font-bold text-sm hover:underline">
                    Schedule Equipment Audit <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-[#444] mt-8">Data source: OSHA/MIOSHA public records • Generated by Detroit Web Agency</p>
        </div>
      </div>
    </>
  );
}
