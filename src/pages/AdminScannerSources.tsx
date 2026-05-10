import { useEffect, useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Toggle = { product: string; source: string; segment: string; enabled: boolean; notes?: string | null };
type Recent = { product: string; source: string; segment: string; count: number; ms: number; error: string | null; created_at: string };
type ProductDef = { product: string; sources: string[] };

export default function AdminScannerSources() {
  const [products, setProducts] = useState<ProductDef[]>([]);
  const [toggles, setToggles] = useState<Toggle[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [product, setProduct] = useState<string>("");
  const [segment, setSegment] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("scanner-source-admin", {
      method: "GET" as any,
    });
    if (error) toast.error(error.message);
    else {
      setProducts(data?.products || []);
      setToggles(data?.toggles || []);
      setRecent(data?.recent || []);
      if (!product && data?.products?.length) setProduct(data.products[0].product);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const currentSources = useMemo(
    () => products.find((p) => p.product === product)?.sources || [],
    [products, product]
  );

  function isEnabled(src: string): boolean {
    const exact = toggles.find((t) => t.product === product && t.source === src && t.segment === segment);
    if (exact) return exact.enabled;
    const all = toggles.find((t) => t.product === product && t.source === src && t.segment === "all");
    return all ? all.enabled : true;
  }

  function healthFor(src: string) {
    const rows = recent.filter((r) => r.product === product && r.source === src).slice(0, 10);
    if (!rows.length) return { label: "—", cls: "text-white/40", last: null as string | null };
    const last = rows[0];
    if (last.error) return { label: "Error", cls: "text-red-400", last: last.created_at };
    if (last.count > 0) return { label: `${last.count} rows`, cls: "text-green-400", last: last.created_at };
    return { label: "0 rows", cls: "text-amber-400", last: last.created_at };
  }

  async function setToggle(src: string, enabled: boolean) {
    setBusy(`t:${src}`);
    const { error } = await supabase.functions.invoke("scanner-source-admin?action=toggle", {
      body: { product, source: src, segment, enabled },
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${src} → ${enabled ? "enabled" : "disabled"} (${segment})`);
    load();
  }

  async function runOne(src?: string) {
    setBusy(`r:${src || "all"}`);
    const { data, error } = await supabase.functions.invoke("scanner-source-admin?action=run", {
      body: { product, segment, source: src },
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    const results = data?.results || [];
    const hits = results.filter((r: any) => r.count > 0).length;
    const errs = results.filter((r: any) => r.error).length;
    toast.success(`Ran ${results.length} source(s) · ${hits} returned data · ${errs} errored`);
    load();
  }

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <Helmet><title>Scanner Sources — Admin</title></Helmet>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-[#00d4ff] text-xs font-extrabold tracking-[3px] mb-2">⚙️ ADMIN — SCANNER SOURCES</p>
        <h1 className="text-2xl font-bold mb-1">Source Toggles & Health</h1>
        <p className="text-[#94a3b8] text-sm mb-6">
          Enable/disable individual scanner sources per product and customer segment. "All" segment is the default — a per-segment override beats the "all" default.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select value={product} onChange={(e) => setProduct(e.target.value)}
            className="bg-slate-900 border border-white/10 text-white text-sm px-3 py-2 rounded">
            {products.map((p) => <option key={p.product} value={p.product}>{p.product}</option>)}
          </select>
          <select value={segment} onChange={(e) => setSegment(e.target.value)}
            className="bg-slate-900 border border-white/10 text-white text-sm px-3 py-2 rounded">
            <option value="all">All customers</option>
            <option value="founders">Founders</option>
            <option value="beta">Beta</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button onClick={load} disabled={loading}
            className="bg-white/5 hover:bg-white/10 text-white/80 text-sm px-3 py-2 rounded flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={() => runOne()} disabled={busy === "r:all" || !product}
            className="ml-auto bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-sm px-3 py-2 rounded flex items-center gap-2">
            {busy === "r:all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run all for {product || "—"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-white/60"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#1e3a5f] bg-[#0a1628]">
            <table className="w-full text-sm">
              <thead className="bg-[#061021] text-white/60 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-left px-4 py-3">Health</th>
                  <th className="text-left px-4 py-3">Last run</th>
                  <th className="text-center px-4 py-3">Enabled</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentSources.map((src) => {
                  const en = isEnabled(src);
                  const h = healthFor(src);
                  return (
                    <tr key={src} className="border-t border-white/5">
                      <td className="px-4 py-2 font-mono text-cyan-300 text-xs">{src}</td>
                      <td className={`px-4 py-2 ${h.cls}`}>{h.label}</td>
                      <td className="px-4 py-2 text-white/50 text-xs">{h.last ? new Date(h.last).toLocaleString() : "never"}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => setToggle(src, !en)}
                          disabled={busy === `t:${src}`}
                          className={`px-3 py-1 rounded text-xs font-bold ${en ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                          {busy === `t:${src}` ? "…" : en ? "ON" : "OFF"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => runOne(src)} disabled={busy === `r:${src}`}
                          className="bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 text-white/70 text-xs px-3 py-1.5 rounded inline-flex items-center gap-1">
                          {busy === `r:${src}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          Run
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {currentSources.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-white/40">No sources registered for this product.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-white/40 mt-4">
          A toggle with segment <code className="text-white/60">all</code> applies as the default; a row matching the current segment overrides it. Health pulls the most recent <code className="text-white/60">scanner_extras_runs</code> entry per source.
        </p>
      </div>
    </div>
  );
}
