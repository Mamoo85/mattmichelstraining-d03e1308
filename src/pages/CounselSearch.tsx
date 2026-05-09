import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

interface SearchResult {
  ok: boolean;
  query: { name: string; aliases: string[]; city?: string; state?: string; case_matter?: string; mode: "paid" | "trial" };
  elapsed_ms: number;
  total_hits: number;
  high_priority_hits: number;
  summary: Record<string, number>;
  results: Record<string, IntelHit[]>;
  quota?: { unlimited?: boolean; tier?: string; free_searches_used?: number; free_trial_limit?: number; remaining?: number };
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
        body: {
          name: name.trim(),
          aliases,
          city: city.trim() || undefined,
          state,
          case_matter: caseMatter.trim() || undefined,
          permissible_purpose: purpose.trim() || "litigation_support",
          attest: true,
        },
      });
      if (error) {
        const msg = (error as Error).message || "Search failed";
        if (msg.includes("quota") || msg.includes("trial_exhausted")) {
          toast.error("Free trial used up — subscribe to continue");
          navigate("/counsel-search");
          return;
        }
        throw error;
      }
      if (data?.error) {
        if (data.error === "trial_exhausted" || data.error === "subscription_required") {
          toast.error(data.message || "Subscribe to continue");
          navigate("/counsel-search");
          return;
        }
        throw new Error(data.message || data.error);
      }
      setResult(data as SearchResult);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Search failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#030711] flex items-center justify-center"><Loader2 className="animate-spin text-[#00d4ff]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <Helmet>
        <title>Search Console — Counsel Records Search</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">⚖️ Counsel Records Search</h1>
        <p className="text-[#94a3b8] text-sm mb-6">Federal + MI court dockets, MDOC, county parcels, AI research. Every cite HEAD-checked.</p>

        <Card className="bg-[#0a1628] border-[#1e3a5f] mb-6">
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
              <span>
                I attest this search is for a permissible purpose under FCRA §1681b(a)(4) (litigation, fraud investigation, or bona-fide legal proceeding) and <strong>not</strong> for tenant screening, employment screening, or credit decisions.
              </span>
            </label>
            <Button className="w-full bg-[#00d4ff] text-black hover:bg-[#00b8e0]" onClick={search} disabled={loading || !attest || !name.trim()}>
              {loading ? <><Loader2 className="animate-spin mr-2" size={16} />Scanning 25+ sources…</> : "Run Search"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-xs text-[#94a3b8]">
              <span><strong className="text-white">{result.total_hits}</strong> hits</span>
              <span><strong className="text-red-400">{result.high_priority_hits}</strong> high-priority</span>
              <span>{result.elapsed_ms}ms</span>
              {result.quota?.unlimited ? (
                <span className="text-[#00d4ff]">✓ Unlimited ({result.quota.tier})</span>
              ) : (
                <span className="text-yellow-400">Trial: {result.quota?.remaining} of {result.quota?.free_trial_limit} remaining</span>
              )}
            </div>
            {Object.entries(result.results).map(([cat, hits]) => (
              <Card key={cat} className="bg-[#0a1628] border-[#1e3a5f]">
                <CardContent className="p-4">
                  <h3 className="font-bold mb-3">{cat} <span className="text-[#94a3b8] text-xs font-normal">({hits.length})</span></h3>
                  <div className="space-y-2">
                    {hits.map((h, i) => (
                      <div key={i} className="border border-[#1e3a5f] rounded p-3 text-sm">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-semibold flex-1">{h.title}</p>
                          {h.severity && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SEVERITY_BADGE[h.severity]}`}>{h.severity.toUpperCase()}</span>}
                        </div>
                        <p className="text-[#cbd5e1] text-xs mb-1">{h.summary}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-[#64748b]">
                          <span>{h.source}</span>
                          {h.date && <span>• {h.date}</span>}
                          {h.location && <span>• {h.location}</span>}
                          {h.alias_match && <span className="text-[#00d4ff]">• via "{h.alias_match}"</span>}
                          {h.source_url && <a href={h.source_url} target="_blank" rel="noopener" className="text-[#00d4ff] underline">View source ↗</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            <p className="text-[10px] text-[#64748b] text-center pt-4">{result.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
