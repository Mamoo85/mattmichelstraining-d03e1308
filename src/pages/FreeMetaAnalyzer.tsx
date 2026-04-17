import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Code, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

export default function FreeMetaAnalyzer() {
  useDwaDomainRedirect();
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("free-meta-analyzer", { body: { url, email } });
      if (fnErr) throw fnErr;
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "pass") return <CheckCircle size={16} className="text-emerald-400" />;
    if (status === "warn") return <AlertTriangle size={16} className="text-amber-400" />;
    return <XCircle size={16} className="text-red-400" />;
  };

  return (
    <>
      <SEOHead title="Free Meta Tag Analyzer | Detroit Web Agency" description="Grade your website's meta tags, Open Graph tags, canonical URL, and robots directives." path="/free-tools/meta-tags" />
      <div className="min-h-screen bg-[#0a0a0f] text-white px-4 py-20">
        <div className="max-w-2xl mx-auto">
          <Link to="/free-tools" className="text-cyan-400 text-sm font-mono mb-6 inline-block">← All Tools</Link>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4"><Code size={12} /> Meta Analyzer</div>
            <h1 className="text-3xl font-black mb-3">Meta Tag Analyzer</h1>
            <p className="text-[#888]">Grade your page's meta tags, OG tags, and technical SEO elements.</p>
          </div>

          {!results ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input placeholder="https://yoursite.com" value={url} onChange={(e) => setUrl(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="your@email.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
              <button type="submit" disabled={loading} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Code size={18} />} {loading ? "Analyzing..." : "Analyze Meta Tags"}
              </button>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center p-6 bg-white/5 border border-white/10 rounded-2xl">
                <div className={`text-5xl font-black mb-2 ${results.grade === "A" ? "text-emerald-400" : results.grade === "B" ? "text-cyan-400" : results.grade === "C" ? "text-amber-400" : "text-red-400"}`}>
                  {results.grade}
                </div>
                <p className="text-[#888] text-sm">{results.pass_count}/{results.total} checks passed</p>
              </div>
              <div className="space-y-3">
                {results.checks?.map((check: any, i: number) => (
                  <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIcon status={check.status} />
                      <span className="text-sm font-bold">{check.label}</span>
                    </div>
                    <p className="text-xs text-[#888] ml-6">{check.detail}</p>
                    <p className="text-xs text-[#555] ml-6 mt-1 truncate">{check.value}</p>
                  </div>
                ))}
              </div>
              <div className="text-center pt-4">
                <Link to="/ai-website-audit" className="text-cyan-400 font-bold text-sm hover:underline">Get a full website diagnostic →</Link>
              </div>
              <button onClick={() => setResults(null)} className="w-full text-[#666] text-sm hover:text-white">Analyze another URL</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
