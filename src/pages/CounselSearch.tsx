import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Printer, Copy } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { trackCounselFirstSearch } from "@/lib/counselSearchAB";

interface IntelHit {
  source: string;
  source_url?: string;
  category: string;
  title: string;
  summary: string;
  date?: string;
  location?: string;
  severity?: "high" | "medium" | "low" | "info";
  alias_match?: string;
}

interface Citation {
  source_name: string;
  source_type: string;
  title: string;
  url: string;
  accessed_at: string;
  bluebook_cite: string;
}

interface SearchResult {
  ok: boolean;
  query: { name: string; aliases: string[]; city?: string; state?: string; case_matter?: string; mode: "paid" | "trial" };
  elapsed_ms: number;
  total_hits: number;
  high_priority_hits: number;
  summary: Record<string, number>;
  results: Record<string, IntelHit[]>;
  citations?: Citation[];
  empty_message?: string | null;
  accessed_at?: string;
  quota?: { unlimited?: boolean; tier?: string; free_searches_used?: number; free_trial_limit?: number; remaining?: number; trial_ends_at?: string | null };
  evidentiary_notice?: string;
  disclaimer: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-yellow-600 text-white",
  low: "bg-blue-600 text-white",
  info: "bg-slate-600 text-white",
};

export default function CounselSearch() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [aliasesStr, setAliasesStr] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("MI");
  const [caseMatter, setCaseMatter] = useState("");
  const [purpose, setPurpose] = useState("");
  const [attest, setAttest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      toast.info("Sign in to start your 7 free searches");
      navigate("/auth?redirect=/counsel-search/console");
    }
  }, [authLoading, user, navigate]);

  const search = async () => {
    if (!name.trim()) return toast.error("Subject name required");
    if (!attest) return toast.error("You must attest to a permissible purpose");
    setLoading(true);
    setResult(null);
    try {
      const aliases = aliasesStr.split(",").map((s) => s.trim()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("counsel-search", {
        body: { name: name.trim(), aliases, city: city.trim() || undefined, state, case_matter: caseMatter.trim() || undefined, permissible_purpose: purpose.trim() || "litigation_support", attest: true },
      });
      if (error) {
        const msg = (error as Error).message || "Search failed";
        if (msg.includes("quota") || msg.includes("trial_exhausted")) { toast.error("Free trial used up — subscribe to continue"); navigate("/counsel-search"); return; }
        throw error;
      }
      if (data?.error) {
        if (data.error === "trial_exhausted" || data.error === "subscription_required") { toast.error(data.message || "Subscribe to continue"); navigate("/counsel-search"); return; }
        throw new Error(data.message || data.error);
      }
      setResult(data as SearchResult);
      trackCounselFirstSearch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Search failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const printPdf = () => window.print();
  const copyAllCites = async () => {
    if (!result?.citations) return;
    const text = result.citations.map((c, i) => `${i + 1}. ${c.bluebook_cite}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${result.citations.length} Bluebook citations`);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#030711] flex items-center justify-center"><Loader2 className="animate-spin text-[#00d4ff]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#030711] text-white print:bg-white print:text-black">
      <Helmet>
        <title>Search Console — Counsel Records Search</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <style>{`
        @media print {
          @page { margin: 0.75in; }
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-card { background: white !important; border: 1px solid #ccc !important; color: black !important; page-break-inside: avoid; }
          .print-text { color: black !important; }
          .print-muted { color: #555 !important; }
          a { color: #0050b3 !important; text-decoration: underline; }
          h1, h2, h3, p, span, li { color: black !important; }
        }
      `}</style>
      <div className="max-w-5xl mx-auto px-4 py-8 print:py-2">
        <h1 className="text-2xl md:text-3xl font-bold mb-2 print-text">⚖️ Counsel Records Search</h1>
        <p className="text-[#94a3b8] text-sm mb-6 print-muted">Court records only — federal (CourtListener + Tax Court), MI appellate, MDOC/PSOR/NSOPW, plus AI-corroborated MI trial-court search. Every hit filtered to require the searched surname.</p>

        <Card className="bg-[#0a1628] border-[#1e3a5f] mb-6 no-print">
          <CardContent className="p-5 space-y-3">
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">Subject Name *</label>
              <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="e.g. John Smith" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">Aliases / AKAs (comma-separated)</label>
              <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="e.g. Johnny Smith, J. Smith" value={aliasesStr} onChange={(e) => setAliasesStr(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#94a3b8] block mb-1">City</label>
                <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="Detroit" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-[#94a3b8] block mb-1">State</label>
                <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">Case / Matter # (audit log)</label>
              <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="e.g. 24-CV-12345" value={caseMatter} onChange={(e) => setCaseMatter(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">Permissible purpose</label>
              <select className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                <option value="">Select…</option>
                <option value="litigation_support">Litigation support / discovery</option>
                <option value="fraud_investigation">Fraud investigation</option>
                <option value="judgment_collection">Judgment collection / asset search</option>
                <option value="due_diligence">Due diligence (legal proceeding)</option>
              </select>
            </div>
            <label className="flex items-start gap-2 text-xs text-[#cbd5e1] pt-2">
              <Checkbox checked={attest} onCheckedChange={(v) => setAttest(!!v)} className="mt-0.5" />
              <span>I attest this search is for a permissible purpose under FCRA §1681b(a)(4) (litigation, fraud investigation, or bona-fide legal proceeding) and <strong>not</strong> for tenant screening, employment screening, or credit decisions.</span>
            </label>
            <Button className="w-full bg-[#00d4ff] text-black hover:bg-[#00b8e0]" onClick={search} disabled={loading || !attest || !name.trim()}>
              {loading ? <><Loader2 className="animate-spin mr-2" size={16} />Scanning 25+ sources…</> : "Run Search"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4">
            {/* Print header — only visible in print */}
            <div className="hidden print:block mb-4 pb-3 border-b">
              <h2 className="text-lg font-bold">Counsel Records Search — Report</h2>
              <p className="text-sm">Subject: <strong>{result.query.name}</strong>{result.query.aliases.length > 0 && <> (aliases: {result.query.aliases.join(", ")})</>}</p>
              {result.query.case_matter && <p className="text-sm">Matter: {result.query.case_matter}</p>}
              <p className="text-xs">Generated: {result.accessed_at ? new Date(result.accessed_at).toLocaleString() : new Date().toLocaleString()}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex flex-wrap gap-3 text-xs text-[#94a3b8]">
                <span><strong className="text-white">{result.total_hits}</strong> hits</span>
                <span><strong className="text-red-400">{result.high_priority_hits}</strong> high-priority</span>
                <span>{result.elapsed_ms}ms</span>
                {result.quota?.unlimited ? (
                  <span className="text-[#00d4ff]">✓ {result.quota.tier === "beta" ? `Beta access${result.quota.trial_ends_at ? ` (until ${new Date(result.quota.trial_ends_at).toLocaleDateString()})` : ""}` : `Unlimited (${result.quota.tier})`}</span>
                ) : (
                  <span className="text-yellow-400">Trial: {result.quota?.remaining} of {result.quota?.free_trial_limit} remaining</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-[#00d4ff] text-black hover:bg-[#00b8e0] font-bold" onClick={printPdf}>
                  <Printer className="w-4 h-4 mr-1.5" /> Print / Save PDF
                </Button>
                {result.citations && result.citations.length > 0 && (
                  <Button size="sm" variant="outline" className="border-[#1e3a5f] text-white hover:bg-[#1e3a5f]" onClick={copyAllCites}>
                    <Copy className="w-4 h-4 mr-1.5" /> Copy All Cites
                  </Button>
                )}
              </div>
            </div>

            {Object.entries(result.results).map(([cat, hits]) => (
              <Card key={cat} className="bg-[#0a1628] border-[#1e3a5f] print-card">
                <CardContent className="p-4">
                  <h3 className="font-bold mb-3 print-text">{cat} <span className="text-[#94a3b8] text-xs font-normal print-muted">({hits.length})</span></h3>
                  <div className="space-y-2">
                    {hits.map((h, i) => (
                      <div key={i} className="border border-[#1e3a5f] rounded p-3 text-sm print-card">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-semibold flex-1 print-text">{h.title}</p>
                          {h.severity && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SEVERITY_BADGE[h.severity]} no-print`}>{h.severity.toUpperCase()}</span>}
                        </div>
                        <p className="text-[#cbd5e1] text-xs mb-1 print-text">{h.summary}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-[#64748b] print-muted">
                          <span>{h.source}</span>
                          {h.date && <span>• {h.date}</span>}
                          {h.location && <span>• {h.location}</span>}
                          {h.alias_match && <span className="text-[#00d4ff]">• via "{h.alias_match}"</span>}
                          {h.source_url && <a href={h.source_url} target="_blank" rel="noopener" className="text-[#00d4ff] underline break-all">{h.source_url}</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Sources & Citations panel — court-citable */}
            {result.citations && result.citations.length > 0 && (
              <Card className="bg-[#0a1628] border-[#00d4ff] print-card">
                <CardContent className="p-4">
                  <h3 className="font-bold mb-1 print-text">📚 Sources & Citations <span className="text-[#94a3b8] text-xs font-normal print-muted">({result.citations.length} verified)</span></h3>
                  <p className="text-[11px] text-[#94a3b8] mb-3 print-muted">Bluebook-formatted. Every URL HEAD-validated at time of access.</p>
                  <ol className="space-y-2 text-xs list-decimal list-inside">
                    {result.citations.map((c, i) => (
                      <li key={i} className="text-[#cbd5e1] print-text leading-relaxed">
                        <span className="font-mono">{c.bluebook_cite}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {result.evidentiary_notice && (
              <Card className="bg-[#0a1628] border-[#1e3a5f] print-card">
                <CardContent className="p-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider mb-2 text-[#00d4ff]">Evidentiary Use Notice</h4>
                  <p className="text-[11px] text-[#cbd5e1] leading-relaxed print-text">{result.evidentiary_notice}</p>
                </CardContent>
              </Card>
            )}

            <p className="text-[10px] text-[#64748b] text-center pt-4 print-muted">{result.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
