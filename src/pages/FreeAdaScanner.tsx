import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, ArrowRight, Loader2, CheckCircle } from "lucide-react";

interface Violation {
  category: string;
  severity: string;
  count: number;
  details: string;
}

export default function FreeAdaScanner() {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const handleScan = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("ada-risk-scanner", {
        body: { url, email: email || undefined },
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
    Critical: "text-red-500 bg-red-500/10 border-red-500/20",
    High: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    Medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    Low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };

  const severityIcon = (s: string) => {
    if (s === "Critical") return <AlertTriangle size={14} className="text-red-500" />;
    if (s === "High") return <AlertTriangle size={14} className="text-orange-500" />;
    return <Shield size={14} className="text-amber-400" />;
  };

  return (
    <>
      <SEOHead title="Free ADA Lawsuit Risk Scanner | Detroit Web Agency" description="Scan your website for WCAG accessibility violations that make you vulnerable to ADA lawsuits — free, instant results." path="/free-tools/ada-scanner" />
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Link to="/free-tools" className="text-cyan-400 text-xs font-mono hover:underline mb-6 inline-block">← All Free Tools</Link>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4">
              <Shield size={12} /> ADA Compliance Scanner
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">Is Your Website a Lawsuit Target?</h1>
            <p className="text-[#888] max-w-xl mx-auto text-sm">Predatory law firms file 4,000+ ADA website lawsuits per year. We'll check if your site is exposed.</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <Input placeholder="Your website URL" value={url} onChange={e => setUrl(e.target.value)} className="bg-white/5 border-white/10" />
            <Input type="email" placeholder="Your email (optional)" value={email} onChange={e => setEmail(e.target.value)} className="bg-white/5 border-white/10" />
            <Button onClick={handleScan} disabled={loading || !url.trim()} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold">
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Scanning for WCAG violations...</> : "Run ADA Risk Scan"}
            </Button>
          </div>

          {error && <p className="text-red-400 text-sm text-center mb-6">{error}</p>}

          {results && (
            <div className="space-y-4">
              {/* Risk score */}
              <div className={`rounded-2xl p-6 text-center border ${riskColors[results.risk_score] || riskColors.Medium}`}>
                {results.risk_score === "Low" ? (
                  <CheckCircle className="mx-auto mb-2 text-emerald-400" size={32} />
                ) : (
                  <AlertTriangle className={`mx-auto mb-2 ${results.risk_score === "Critical" ? "text-red-500" : "text-orange-500"}`} size={32} />
                )}
                <p className="text-2xl font-black mb-1">Risk Level: {results.risk_score}</p>
                <p className="text-sm text-[#888]">Lawsuit Probability: {results.lawsuit_probability || "Unknown"}</p>
                {results.estimated_remediation_cost && (
                  <p className="text-xs text-[#666] mt-1">Est. remediation: {results.estimated_remediation_cost}</p>
                )}
              </div>

              {/* Summary */}
              {results.summary && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <p className="text-sm text-[#ccc]">{results.summary}</p>
                </div>
              )}

              {/* Violations */}
              {results.violations?.length > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-[#aaa] uppercase tracking-widest mb-4">Violations Found</h3>
                  <div className="space-y-3">
                    {results.violations.map((v: Violation, i: number) => (
                      <div key={i} className="bg-white/[0.02] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {severityIcon(v.severity)}
                            <span className="font-bold text-sm">{v.category}</span>
                          </div>
                          <span className="text-xs text-[#666]">{v.severity} • {v.count} instances</span>
                        </div>
                        <p className="text-xs text-[#888]">{v.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.risk_score !== "Low" && (
                <div className="bg-cyan-500/5 border border-cyan-400/20 rounded-2xl p-6 text-center">
                  <p className="text-sm font-bold mb-2">Your site is vulnerable to an ADA compliance lawsuit.</p>
                  <p className="text-xs text-[#888] mb-3">We rebuild websites with enterprise-grade WCAG 2.1 AA compliance baked in.</p>
                  <Link to="/agency" className="inline-flex items-center gap-2 text-cyan-400 font-bold text-sm hover:underline">
                    Get a Compliant Rebuild <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-[#444] mt-8">Generated by Detroit Web Agency — detroitwebagent.com</p>
        </div>
      </div>
    </>
  );
}
