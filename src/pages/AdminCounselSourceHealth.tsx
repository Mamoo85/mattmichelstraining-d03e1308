import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type SearchRow = {
  id: string;
  created_at: string;
  query_name: string;
  sources_hit: number | null;
  sources_returned: number | null;
  total_hits: number | null;
  full_results: { hits?: Array<{ source: string; category?: string; severity?: string }> } | null;
};

type SourceStat = {
  source: string;
  searches: number; // # of searches that touched this source (= total runs since each search calls every source)
  searches_with_hits: number;
  total_hits: number;
  hit_rate: number; // searches_with_hits / searches
};

const STATUS = (s: SourceStat) => {
  if (s.searches === 0) return { label: "—", cls: "text-white/40" };
  if (s.searches_with_hits === 0) return { label: "Silent", cls: "text-amber-400", icon: AlertTriangle };
  if (s.hit_rate >= 0.25) return { label: "Active", cls: "text-green-400", icon: CheckCircle2 };
  return { label: "Sparse", cls: "text-blue-300", icon: CheckCircle2 };
};

export default function AdminCounselSourceHealth() {
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState(30);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - windowDays * 86400_000).toISOString();
    const { data, error } = await supabase
      .from("counsel_searches")
      .select("id,created_at,query_name,sources_hit,sources_returned,total_hits,full_results")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error) setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays]);

  const stats = useMemo<SourceStat[]>(() => {
    const map = new Map<string, { searches: number; with_hits: number; total: number }>();
    const totalSearches = rows.length;
    // First pass: collect every unique source name we've ever seen so 0-hit sources still show
    for (const r of rows) {
      const hits = r.full_results?.hits || [];
      const seenInThisSearch = new Set<string>();
      for (const h of hits) {
        if (!h.source) continue;
        seenInThisSearch.add(h.source);
        const cur = map.get(h.source) || { searches: 0, with_hits: 0, total: 0 };
        cur.total += 1;
        map.set(h.source, cur);
      }
      for (const src of seenInThisSearch) {
        const cur = map.get(src)!;
        cur.with_hits += 1;
      }
    }
    const out: SourceStat[] = [];
    for (const [source, v] of map.entries()) {
      out.push({
        source,
        searches: totalSearches,
        searches_with_hits: v.with_hits,
        total_hits: v.total,
        hit_rate: totalSearches ? v.with_hits / totalSearches : 0,
      });
    }
    out.sort((a, b) => b.total_hits - a.total_hits || a.source.localeCompare(b.source));
    return out;
  }, [rows]);

  const totals = useMemo(() => {
    return {
      searches: rows.length,
      hits: rows.reduce((a, r) => a + (r.total_hits || 0), 0),
      sources: stats.length,
      silent: stats.filter((s) => s.searches_with_hits === 0).length,
    };
  }, [rows, stats]);

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <Helmet><title>Counsel Source Health — Admin</title></Helmet>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-[#00d4ff] text-xs font-extrabold tracking-[3px] mb-2">⚖️ ADMIN — COUNSEL SEARCH</p>
        <h1 className="text-2xl font-bold mb-1">Per-Source Health</h1>
        <p className="text-[#94a3b8] text-sm mb-6">
          Every external source the counsel-search engine queried over the last {windowDays} days, with hit counts pulled from <code className="text-xs text-white/70">counsel_searches.full_results</code>. Sources with 0 hits across many searches likely need an API key, are blocked, or return no matches for the cohort.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={windowDays === d ? "default" : "outline"} onClick={() => setWindowDays(d)}>
              Last {d}d
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="ml-auto">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-4">
            <div className="text-xs text-white/60">Searches</div>
            <div className="text-2xl font-bold">{totals.searches}</div>
          </CardContent></Card>
          <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-4">
            <div className="text-xs text-white/60">Total hits</div>
            <div className="text-2xl font-bold">{totals.hits}</div>
          </CardContent></Card>
          <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-4">
            <div className="text-xs text-white/60">Producing sources</div>
            <div className="text-2xl font-bold">{totals.sources}</div>
          </CardContent></Card>
          <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-4">
            <div className="text-xs text-white/60">Silent (0 hits)</div>
            <div className={`text-2xl font-bold ${totals.silent > 0 ? "text-amber-400" : ""}`}>{totals.silent}</div>
          </CardContent></Card>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-white/60"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-8 text-center text-white/60">
            No searches in the last {windowDays} days. Run a search from <code>/counsel-search/console</code> to populate stats.
          </CardContent></Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#1e3a5f] bg-[#0a1628]">
            <table className="w-full text-sm">
              <thead className="bg-[#061021] text-white/60 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-right px-4 py-3">Total hits</th>
                  <th className="text-right px-4 py-3">Searches w/ hits</th>
                  <th className="text-right px-4 py-3">Hit rate</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => {
                  const st = STATUS(s);
                  const Icon = (st as any).icon;
                  return (
                    <tr key={s.source} className="border-t border-white/5">
                      <td className="px-4 py-3 font-medium">{s.source}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.total_hits}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.searches_with_hits} / {s.searches}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{(s.hit_rate * 100).toFixed(0)}%</td>
                      <td className={`px-4 py-3 ${st.cls}`}>
                        <span className="inline-flex items-center gap-1">
                          {Icon ? <Icon className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-white/40 mt-4">
          Note: each counsel-search run calls every source in parallel. A "silent" source means the API returned 200 but produced zero hits for any name searched in this window — that's normal for niche sources (FAA Airmen, ICIJ, NTSB) but a red flag for broad sources like CourtListener.
        </p>
      </div>
    </div>
  );
}
