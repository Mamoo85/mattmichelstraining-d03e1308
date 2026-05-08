import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface IntelHit {
  source: string;
  source_url?: string;
  category: string;
  title: string;
  summary: string;
  date?: string;
  location?: string;
  severity?: "high" | "medium" | "low" | "info";
}

interface SearchResult {
  ok: boolean;
  query: { name: string; city: string; state: string };
  elapsed_ms: number;
  sources_hit: number;
  sources_returned: number;
  total_hits: number;
  high_priority_hits: number;
  summary: Record<string, number>;
  results: Record<string, IntelHit[]>;
  disclaimer: string;
}

const CATEGORY_ORDER = [
  "Criminal Records",
  "Eviction Records",
  "Court Records",
  "Financial Records",
  "Property Violations",
  "Property Records",
  "Identity & Address History",
  "Business Records",
  "Government Records",
  "News & Public Notices",
  "Social Media Presence",
];

const CATEGORY_ICONS: Record<string, string> = {
  "Criminal Records": "🚨",
  "Eviction Records": "🏠",
  "Court Records": "⚖️",
  "Financial Records": "💰",
  "Property Violations": "⚠️",
  "Property Records": "📋",
  "Identity & Address History": "👤",
  "Business Records": "🏢",
  "Government Records": "🏛️",
  "News & Public Notices": "📰",
  "Social Media Presence": "🌐",
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-red-900/40 border-red-500/60 text-red-100",
  medium: "bg-yellow-900/30 border-yellow-500/50 text-yellow-100",
  low: "bg-blue-900/30 border-blue-500/40 text-blue-100",
  info: "bg-slate-800/60 border-slate-600/40 text-slate-100",
};

const SEVERITY_BADGE: Record<string, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-yellow-600 text-white",
  low: "bg-blue-600 text-white",
  info: "bg-slate-600 text-white",
};

const SEVERITY_LABEL: Record<string, string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  info: "INFO",
};

function HitCard({ hit }: { hit: IntelHit }) {
  const sev = hit.severity || "info";
  return (
    <div className={`rounded-lg border p-4 mb-3 ${SEVERITY_STYLES[sev]}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${SEVERITY_BADGE[sev]}`}>
              {SEVERITY_LABEL[sev]}
            </span>
            <span className="text-xs text-slate-400">{hit.source}</span>
            {hit.date && (
              <span className="text-xs text-slate-400">
                {new Date(hit.date).toLocaleDateString()}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-white mt-1 text-sm leading-snug">{hit.title}</h4>
        </div>
      </div>
      <p className="text-sm leading-relaxed opacity-90">{hit.summary}</p>
      <div className="flex items-center gap-3 mt-2">
        {hit.location && (
          <span className="text-xs opacity-60">📍 {hit.location}</span>
        )}
        {hit.source_url && (
          <a
            href={hit.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            View Source →
          </a>
        )}
      </div>
    </div>
  );
}

function CategorySection({ category, hits }: { category: string; hits: IntelHit[] }) {
  const [expanded, setExpanded] = useState(true);
  const icon = CATEGORY_ICONS[category] || "📄";
  const highCount = hits.filter(h => h.severity === "high").length;
  const mediumCount = hits.filter(h => h.severity === "medium").length;

  return (
    <Card className="bg-slate-900/80 border-slate-700 mb-4">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <span>{icon}</span>
            <span>{category}</span>
            <span className="text-slate-400 font-normal text-sm">({hits.length})</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {highCount > 0 && (
              <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold">
                {highCount} HIGH
              </span>
            )}
            {mediumCount > 0 && (
              <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded-full font-semibold">
                {mediumCount} MED
              </span>
            )}
            <span className="text-slate-400 text-sm">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <Separator className="bg-slate-700 mb-3" />
          {hits.map((hit, i) => <HitCard key={i} hit={hit} />)}
        </CardContent>
      )}
    </Card>
  );
}

export default function TenantIntel() {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState(searchParams.get("name") || "");
  const [city, setCity] = useState(searchParams.get("city") || "Detroit");
  const [state, setState] = useState(searchParams.get("state") || "MI");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalHighPriority = result
    ? Object.values(result.results)
        .flat()
        .filter(h => h.severity === "high").length
    : 0;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tenant-intel-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ name: name.trim(), city: city.trim(), state: state.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Search failed");
      setResult(data);
      // Update URL for sharing
      const params = new URLSearchParams({ name: name.trim(), city: city.trim(), state: state.trim() });
      window.history.replaceState(null, "", `/tenant-intel?${params.toString()}`);
    } catch (err: any) {
      setError(err.message || "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const orderedCategories = result
    ? [
        ...CATEGORY_ORDER.filter(c => result.results[c]?.length > 0),
        ...Object.keys(result.results).filter(c => !CATEGORY_ORDER.includes(c) && result.results[c]?.length > 0),
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#00d4ff]">Tenant Intel</h1>
            <p className="text-xs text-slate-400">Public records aggregation by Detroit Web Agency</p>
          </div>
          <div className="text-xs text-slate-500 text-right max-w-xs hidden sm:block">
            Public records only · Litigation use exempt (FCRA §1681b(a)(4))
          </div>
        </div>
      </div>

      {/* Search Form */}
      <div className={`${result ? "py-6" : "py-16"} px-6 transition-all`}>
        <div className="max-w-2xl mx-auto">
          {!result && (
            <div className="text-center mb-10">
              <div className="text-5xl mb-4">🔍</div>
              <h2 className="text-3xl font-bold text-white mb-2">Public Records Search</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Search 25+ public data sources simultaneously. Court records, criminal history, evictions, property records, and more.
              </p>
            </div>
          )}

          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-slate-400 text-xs mb-1 block">Full Name *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="First Last"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 h-11"
                  required
                />
              </div>
              <div className="w-40">
                <Label className="text-slate-400 text-xs mb-1 block">City</Label>
                <Input
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Detroit"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 h-11"
                />
              </div>
              <div className="w-20">
                <Label className="text-slate-400 text-xs mb-1 block">State</Label>
                <Input
                  value={state}
                  onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="MI"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 h-11 text-center"
                  maxLength={2}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full h-11 bg-[#00d4ff] hover:bg-[#00b8d9] text-black font-semibold text-base"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Searching {result ? "again" : "25+ sources"}…
                </span>
              ) : (
                `Search ${result ? "Again" : "Public Records"}`
              )}
            </Button>
          </form>

          {loading && (
            <div className="mt-6 text-center">
              <p className="text-slate-400 text-sm">Querying federal courts, criminal registries, property records, and AI-powered web research…</p>
              <div className="flex justify-center gap-1 mt-3">
                {["Federal Courts", "Criminal", "Property", "People Search", "AI Research"].map((s, i) => (
                  <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-red-900/40 border border-red-500/50 rounded-lg p-4 text-red-200 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="max-w-4xl mx-auto px-6 pb-16">
          {/* Results Summary Bar */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 mb-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-white font-bold text-lg">
                  Results for <span className="text-[#00d4ff]">{result.query.name}</span>
                </h3>
                <p className="text-slate-400 text-sm">{result.query.city}, {result.query.state} · {result.elapsed_ms}ms · {result.sources_returned}/{result.sources_hit} sources returned data</p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${totalHighPriority > 0 ? "text-red-400" : "text-slate-400"}`}>
                    {totalHighPriority}
                  </div>
                  <div className="text-xs text-slate-500">High Priority</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{result.total_hits}</div>
                  <div className="text-xs text-slate-500">Total Hits</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#00d4ff]">{Object.keys(result.results).length}</div>
                  <div className="text-xs text-slate-500">Categories</div>
                </div>
              </div>
            </div>

            {/* Category pills */}
            {Object.keys(result.summary).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-700">
                {orderedCategories.map(cat => (
                  <span key={cat} className="text-xs bg-slate-700 text-slate-200 px-2 py-1 rounded-full flex items-center gap-1">
                    {CATEGORY_ICONS[cat] || "📄"} {cat} <span className="bg-slate-600 px-1.5 rounded-full">{result.results[cat].length}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* No results state */}
          {result.total_hits === 0 && (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-semibold text-white">No public records found</p>
              <p className="text-sm mt-1">No hits across {result.sources_hit} sources for this name in {result.query.city}, {result.query.state}.</p>
              <p className="text-xs mt-3 opacity-60">Try a different city, state, or spelling. Some records may require in-person court access.</p>
            </div>
          )}

          {/* Results by category */}
          {orderedCategories.map(cat => (
            <CategorySection key={cat} category={cat} hits={result.results[cat]} />
          ))}

          {/* Disclaimer */}
          <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700 rounded-lg">
            <p className="text-xs text-slate-500 leading-relaxed">{result.disclaimer}</p>
            <p className="text-xs text-slate-600 mt-1">
              Share this search: <span className="text-slate-400 font-mono">{window.location.href}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
