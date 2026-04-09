import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Shield, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function FreeBreachScanner() {
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("free-breach-scanner", { body: { domain, email } });
      if (fnErr) throw fnErr;
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead title="Free Domain Breach Scanner | Detroit Web Agency" description="Check if your business domain has been exposed in known data breaches." path="/free-tools/breach-scan" />
      <div className="min-h-screen bg-[#0a0a0f] text-white px-4 py-20">
        <div className="max-w-2xl mx-auto">
          <Link to="/free-tools" className="text-cyan-400 text-sm font-mono mb-6 inline-block">← All Tools</Link>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-400/10 text-red-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4"><Shield size={12} /> Breach Scanner</div>
            <h1 className="text-3xl font-black mb-3">Domain Breach Scanner</h1>
            <p className="text-[#888]">Check if your business domain has appeared in known data breaches.</p>
          </div>

          {!results ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input placeholder="yourbusiness.com" value={domain} onChange={(e) => setDomain(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="your@email.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
              <button type="submit" disabled={loading} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Shield size={18} />} {loading ? "Scanning..." : "Scan for Breaches"}
              </button>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </form>
          ) : (
            <div className="space-y-6">
              <div className={`text-center p-6 border rounded-2xl ${results.risk_level === "LOW" ? "bg-emerald-500/10 border-emerald-500/30" : results.risk_level === "MEDIUM" ? "bg-amber-500/10 border-amber-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                {results.breach_count === 0 ? <CheckCircle size={40} className="text-emerald-400 mx-auto mb-2" /> : <AlertTriangle size={40} className="text-red-400 mx-auto mb-2" />}
                <div className="text-2xl font-black mb-1">{results.breach_count} Breach{results.breach_count !== 1 ? "es" : ""} Found</div>
                <p className="text-sm text-[#888]">Risk Level: <span className={`font-bold ${results.risk_level === "LOW" ? "text-emerald-400" : results.risk_level === "MEDIUM" ? "text-amber-400" : "text-red-400"}`}>{results.risk_level}</span></p>
              </div>
              {results.breaches?.length > 0 && (
                <div className="space-y-3">
                  {results.breaches.map((b: any, i: number) => (
                    <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-sm">{b.title}</h3>
                        <span className="text-xs text-[#666]">{b.date}</span>
                      </div>
                      <p className="text-xs text-[#888] mb-2">{b.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {b.data_classes?.slice(0, 5).map((dc: string) => (
                          <span key={dc} className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-300 rounded-full">{dc}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-center pt-4">
                <Link to="/ai-website-audit" className="text-cyan-400 font-bold text-sm hover:underline">Get a full security audit →</Link>
              </div>
              <button onClick={() => setResults(null)} className="w-full text-[#666] text-sm hover:text-white">Scan another domain</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
