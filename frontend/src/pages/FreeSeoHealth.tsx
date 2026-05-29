import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

export default function FreeSeoHealth() {
  
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
      const { data, error: fnErr } = await supabase.functions.invoke("free-seo-health-check", { body: { url, email } });
      if (fnErr) throw fnErr;
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Scan failed");
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
      <SEOHead title="Free SEO Health Check | Detroit Web Agency" description="Analyze your page's SEO health: title tags, meta descriptions, headings, and content score." path="/free-tools/seo-health" />
      <div className="min-h-screen bg-[#0a0a0f] text-white px-4 py-20">
        <div className="max-w-2xl mx-auto">
          <Link to="/free-tools" className="text-cyan-400 text-sm font-mono mb-6 inline-block">← All Tools</Link>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-400/10 text-cyan-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4"><Search size={12} /> SEO Health Check</div>
            <h1 className="text-3xl font-black mb-3">Free SEO Health Check</h1>
            <p className="text-[#888]">Enter any URL to get an instant SEO scorecard.</p>
          </div>

          {!results ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input placeholder="https://yoursite.com" value={url} onChange={(e) => setUrl(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="your@email.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
              <button type="submit" disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />} {loading ? "Scanning..." : "Run SEO Health Check"}
              </button>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center p-6 bg-white/5 border border-white/10 rounded-2xl">
                <div className="text-5xl font-black text-cyan-400 mb-2">{results.score}/100</div>
                <p className="text-[#888] text-sm">SEO Health Score</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Title Tag", value: `${results.title_length} chars`, good: results.title_length >= 30 && results.title_length <= 60 },
                  { label: "Meta Description", value: `${results.description_length} chars`, good: results.description_length >= 120 && results.description_length <= 160 },
                  { label: "H1 Tags", value: `${results.h1_count} found`, good: results.h1_count === 1 },
                  { label: "Word Count", value: `${results.word_count} words`, good: results.word_count >= 300 },
                  { label: "Images w/o Alt", value: `${results.images_without_alt} of ${results.total_images}`, good: results.images_without_alt === 0 },
                  { label: "Canonical Tag", value: results.has_canonical ? "Present" : "Missing", good: results.has_canonical },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={item.good ? "pass" : "warn"} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <span className="text-sm text-[#888]">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="text-center pt-4">
                <Link to="/ai-website-audit" className="text-cyan-400 font-bold text-sm hover:underline">Want a full diagnostic? Get your free website audit →</Link>
              </div>
              <button onClick={() => setResults(null)} className="w-full text-[#666] text-sm hover:text-white">Scan another URL</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
