// Source Catalog Panel — view/refresh the 50 free data sources
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Database, RefreshCw } from "lucide-react";

interface CacheRow {
  source_id: string;
  cache_key: string;
  row_count: number;
  fetched_at: string;
  expires_at: string | null;
  fetch_error: string | null;
}

export default function SourceCatalogPanel() {
  const [registry, setRegistry] = useState<any[]>([]);
  const [cache, setCache] = useState<CacheRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
    const anon = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
    let sources: any[] = [];
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/data-source-fetch?list=1`, {
        headers: { Authorization: `Bearer ${anon}`, apikey: anon },
      });
      const json = await res.json();
      sources = json?.sources || [];
    } catch { /* ignore */ }
    const { data: cacheRows } = await supabase.from("data_source_cache" as any)
      .select("source_id, cache_key, row_count, fetched_at, expires_at, fetch_error")
      .order("fetched_at", { ascending: false })
      .limit(200);
    setRegistry(sources);
    setCache((cacheRows as any) || []);
  }

  useEffect(() => { load(); }, []);

  async function refresh(sourceId: string) {
    setBusy(sourceId);
    try {
      const { data, error } = await supabase.functions.invoke("data-source-fetch", {
        body: { source_id: sourceId, force_refresh: true },
      });
      if (error) throw error;
      toast.success(`${sourceId}: ${data?.row_count ?? 0} rows cached`);
      load();
    } catch (e) {
      toast.error(`${sourceId} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  // Group cache by source for quick stats
  const statsBySrc = new Map<string, { rows: number; lastFetch: string | null; err: string | null }>();
  cache.forEach((c) => {
    const cur = statsBySrc.get(c.source_id) || { rows: 0, lastFetch: null, err: null };
    cur.rows += c.row_count;
    if (!cur.lastFetch || c.fetched_at > cur.lastFetch) cur.lastFetch = c.fetched_at;
    if (c.fetch_error) cur.err = c.fetch_error;
    statsBySrc.set(c.source_id, cur);
  });

  const filtered = registry.filter((s) =>
    !filter || s.id?.toLowerCase().includes(filter.toLowerCase()) ||
    s.name?.toLowerCase().includes(filter.toLowerCase()) ||
    s.category?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="border border-white/10 bg-slate-900/50 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white">Data Source Catalog</h3>
            <span className="text-xs text-white/50">{registry.length} sources · {cache.length} cached entries</span>
          </div>
          <input value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by id/name/category"
            className="bg-slate-950 border border-white/10 text-white text-xs px-2 py-1.5 rounded w-64" />
        </div>

        {registry.length === 0 ? (
          <div className="text-xs text-white/40 py-6 text-center">
            No sources loaded. The catalog lives in <code className="text-cyan-400">_shared/sources/registry.json</code>.
          </div>
        ) : (
          <div className="grid gap-1.5 max-h-[600px] overflow-y-auto">
            {filtered.map((s: any) => {
              const stats = statsBySrc.get(s.id);
              return (
                <div key={s.id} className="grid grid-cols-12 gap-2 items-center bg-slate-950/40 border border-white/5 rounded px-2 py-1.5 text-xs">
                  <span className="col-span-3 font-mono text-cyan-400 truncate">{s.id}</span>
                  <span className="col-span-3 text-white/70 truncate">{s.name || "-"}</span>
                  <span className="col-span-2 text-white/40">{s.category || s.scope || "-"}</span>
                  <span className="col-span-1 text-white/60">{stats?.rows ?? 0} rows</span>
                  <span className="col-span-2 text-white/40">
                    {stats?.lastFetch ? new Date(stats.lastFetch).toLocaleDateString() : "never"}
                    {stats?.err && <span className="text-red-400 ml-1" title={stats.err}>⚠</span>}
                  </span>
                  <button onClick={() => refresh(s.id)} disabled={busy === s.id}
                    className="col-span-1 bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-400 disabled:opacity-30 text-white/60 px-2 py-1 rounded flex items-center justify-center gap-1">
                    {busy === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
