import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Code, TrendingUp, ArrowRight, Loader2, DollarSign } from "lucide-react";

interface Gap {
  service: string;
  revenue_potential: string;
  reasoning: string;
}

import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

export default function FreeServiceGapScanner() {
  useDwaDomainRedirect();
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ gaps: Gap[]; summary: string } | null>(null);
  const [error, setError] = useState("");

  const handleScan = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("service-gap-scanner", {
        body: { url, email: email || undefined },
      });
      if (fnErr) throw fnErr;
      if (data?.success) setResults({ gaps: data.gaps || [], summary: data.summary || "" });
      else setError(data?.message || "We couldn't read this page right now. Try again in a minute.");
    } catch {
      setError("Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const potentialColor = (p: string) => {
    if (p === "High") return "text-emerald-400 bg-emerald-500/10";
    if (p === "Medium") return "text-amber-400 bg-amber-500/10";
    return "text-[#888] bg-white/5";
  };

  return (
    <>
      <SEOHead title="Free Competitor Service Gap Scanner | Detroit Web Agency" description="See which high-margin services your competitors rank for that you're missing — free website competitive analysis." path="/free-tools/service-gap" />
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Link to="/free-tools" className="text-cyan-400 text-xs font-mono hover:underline mb-6 inline-block">← All Free Tools</Link>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4">
              <TrendingUp size={12} /> Service Gap Analysis
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">What Services Are Your Competitors Stealing?</h1>
            <p className="text-[#888] max-w-xl mx-auto text-sm">We scrape your site and your top competitors to find the high-margin services you're leaving on the table.</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <Input placeholder="Your website URL (e.g. mycompany.com)" value={url} onChange={e => setUrl(e.target.value)} className="bg-white/5 border-white/10" />
            <Input type="email" placeholder="Your email (optional)" value={email} onChange={e => setEmail(e.target.value)} className="bg-white/5 border-white/10" />
            <Button onClick={handleScan} disabled={loading || !url.trim()} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold">
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Analyzing competitors (30-60s)...</> : "Scan for Service Gaps"}
            </Button>
          </div>

          {error && <p className="text-red-400 text-sm text-center mb-6">{error}</p>}

          {results && (
            <div className="space-y-4">
              {results.summary && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-[#aaa] uppercase tracking-widest mb-2">Analysis Summary</h3>
                  <p className="text-sm text-[#ccc]">{results.summary}</p>
                </div>
              )}

              {results.gaps.length > 0 ? (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-[#aaa] uppercase tracking-widest mb-4">Services You're Missing</h3>
                  <div className="space-y-3">
                    {results.gaps.map((g, i) => (
                      <div key={i} className="bg-white/[0.02] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Code size={14} className="text-cyan-400" />
                            <span className="font-bold text-sm">{g.service}</span>
                          </div>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${potentialColor(g.revenue_potential)}`}>
                            <DollarSign size={10} className="inline" /> {g.revenue_potential}
                          </span>
                        </div>
                        <p className="text-xs text-[#888]">{g.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 text-center">
                  <p className="text-emerald-400 font-bold">No major service gaps found — your website covers the key services.</p>
                </div>
              )}

              {results.gaps.length > 0 && (
                <div className="bg-cyan-500/5 border border-cyan-400/20 rounded-2xl p-6 text-center">
                  <p className="text-sm font-bold mb-2">Your competitors are ranking for {results.gaps.length} services you don't list.</p>
                  <p className="text-xs text-[#888] mb-3">Let us rebuild your digital footprint to capture this market.</p>
                  <Link to="/agency" className="inline-flex items-center gap-2 text-cyan-400 font-bold text-sm hover:underline">
                    Get a Website Rebuild Quote <ArrowRight size={14} />
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
