import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { BarChart3, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

export default function FreeRankChecker() {
  
  useDwaDomainRedirect();
  const [email, setEmail] = useState("");
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("United States");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("free-rank-checker", { body: { keyword, location, email } });
      if (fnErr) throw fnErr;
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Check failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead title="Free Competitor Rank Checker | Detroit Web Agency" description="See who ranks in the top 10 for any keyword. Free SERP checker tool." path="/free-tools/rank-check" />
      <div className="min-h-screen bg-[#0a0a0f] text-white px-4 py-20">
        <div className="max-w-2xl mx-auto">
          <Link to="/free-tools" className="text-cyan-400 text-sm font-mono mb-6 inline-block">← All Tools</Link>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-400/10 text-violet-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4"><BarChart3 size={12} /> Rank Checker</div>
            <h1 className="text-3xl font-black mb-3">Competitor Rank Checker</h1>
            <p className="text-[#888]">See who ranks in the top 10 for any keyword.</p>
          </div>

          {!results ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input placeholder="e.g. plumber near me" value={keyword} onChange={(e) => setKeyword(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="Location (e.g. Detroit, Michigan)" value={location} onChange={(e) => setLocation(e.target.value)} className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="your@email.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
              <button type="submit" disabled={loading} className="w-full bg-violet-500 hover:bg-violet-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <BarChart3 size={18} />} {loading ? "Checking..." : "Check Rankings"}
              </button>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center p-4 bg-white/5 border border-white/10 rounded-2xl">
                <p className="text-sm text-[#888]">Top 10 results for</p>
                <p className="text-xl font-black text-cyan-400">"{results.keyword}"</p>
                <p className="text-xs text-[#555]">{results.location}</p>
              </div>
              <div className="space-y-2">
                {results.rankings?.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-cyan-400 font-mono font-bold text-sm w-6">#{r.position}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{r.title}</p>
                      <p className="text-xs text-cyan-400/70 truncate">{r.domain}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center pt-4">
                <Link to="/seo-guard" className="text-cyan-400 font-bold text-sm hover:underline">Want to track rankings weekly? Learn about SEO Guard →</Link>
              </div>
              <button onClick={() => setResults(null)} className="w-full text-[#666] text-sm hover:text-white">Check another keyword</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
