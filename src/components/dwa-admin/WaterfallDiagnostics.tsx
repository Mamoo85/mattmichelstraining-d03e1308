import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingDown, AlertTriangle } from "lucide-react";

interface RawDumpRow {
  id: string;
  scanner: string;
  source: string;
  vertical: string | null;
  fetched_at: string;
  pulled_count: number | null;
  kept_after_gate: number | null;
  enriched_count: number | null;
  final_inserted: number | null;
  ai_cost_usd: number | null;
  duration_ms: number | null;
  notes: string | null;
}

interface Props {
  scannerFilter?: string[]; // e.g. ["hire-alert-scanner"] for Talent
}

export default function WaterfallDiagnostics({ scannerFilter }: Props) {
  const [rows, setRows] = useState<RawDumpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    let q = supabase
      .from("raw_signals_dump" as any)
      .select("id, scanner, source, vertical, fetched_at, pulled_count, kept_after_gate, enriched_count, final_inserted, ai_cost_usd, duration_ms, notes")
      .order("fetched_at", { ascending: false })
      .limit(50);
    if (scannerFilter?.length) q = q.in("scanner", scannerFilter);
    const { data, error } = await q;
    if (error) setErr(error.message);
    setRows(((data as any) || []) as RawDumpRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [JSON.stringify(scannerFilter)]);

  const fmtTime = (s: string) => new Date(s).toLocaleString("en-US", {
    timeZone: "America/Detroit", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const dropPct = (from: number | null, to: number | null) => {
    if (!from || from === 0 || to == null) return null;
    return Math.round((1 - to / from) * 100);
  };

  const healthColor = (pulled: number | null, final: number | null) => {
    if (!pulled || pulled === 0) return "text-white/30";
    const keep = (final || 0) / pulled;
    if (keep >= 0.05) return "text-emerald-400";
    if (keep >= 0.01) return "text-amber-400";
    return "text-rose-400";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/50">
          Waterfall drop-off per scanner run · last 50 · times in ET ·{" "}
          <span className="text-emerald-400">green</span> = healthy keep rate (≥5%) ·{" "}
          <span className="text-amber-400">amber</span> = thin (1–5%) ·{" "}
          <span className="text-rose-400">red</span> = vacuum likely pointed wrong (&lt;1%)
        </div>
        <button
          onClick={load}
          className="text-[11px] px-2 py-1 rounded border border-white/10 text-white/70 hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {err && (
        <div className="text-rose-300 text-sm flex items-center gap-2 p-3 rounded bg-rose-500/10 border border-rose-500/30">
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-white/50 p-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading waterfall…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-white/40 text-sm p-6 text-center rounded border border-white/10 bg-white/5">
          <TrendingDown className="w-6 h-6 mx-auto mb-2 opacity-40" />
          No waterfall data yet. After the next scanner run, drop-off math will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-white/60">
              <tr>
                <th className="text-left p-2 font-mono">Time</th>
                <th className="text-left p-2 font-mono">Scanner</th>
                <th className="text-left p-2 font-mono">Vert</th>
                <th className="text-right p-2 font-mono">Pulled</th>
                <th className="text-right p-2 font-mono">→ Gate</th>
                <th className="text-right p-2 font-mono">→ Enrich</th>
                <th className="text-right p-2 font-mono">→ Final</th>
                <th className="text-right p-2 font-mono">$ AI</th>
                <th className="text-right p-2 font-mono">ms</th>
                <th className="text-left p-2 font-mono">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const gateDrop = dropPct(r.pulled_count, r.kept_after_gate);
                const enrichDrop = dropPct(r.kept_after_gate, r.enriched_count);
                const finalDrop = dropPct(r.enriched_count, r.final_inserted);
                return (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 text-white/70">{fmtTime(r.fetched_at)}</td>
                    <td className="p-2 text-[#00d4ff]">{r.scanner.replace("-scanner", "")}</td>
                    <td className="p-2 text-white/50">{r.vertical || "—"}</td>
                    <td className="p-2 text-right text-white font-bold">{r.pulled_count ?? "—"}</td>
                    <td className="p-2 text-right text-white/80">
                      {r.kept_after_gate ?? "—"}
                      {gateDrop != null && gateDrop > 0 && (
                        <span className="text-white/30 text-[10px] ml-1">−{gateDrop}%</span>
                      )}
                    </td>
                    <td className="p-2 text-right text-white/80">
                      {r.enriched_count ?? "—"}
                      {enrichDrop != null && enrichDrop > 0 && (
                        <span className="text-white/30 text-[10px] ml-1">−{enrichDrop}%</span>
                      )}
                    </td>
                    <td className={`p-2 text-right font-bold ${healthColor(r.pulled_count, r.final_inserted)}`}>
                      {r.final_inserted ?? "—"}
                      {finalDrop != null && finalDrop > 0 && (
                        <span className="text-white/30 text-[10px] ml-1 font-normal">−{finalDrop}%</span>
                      )}
                    </td>
                    <td className="p-2 text-right text-amber-300 font-mono">
                      {r.ai_cost_usd != null ? `$${r.ai_cost_usd.toFixed(2)}` : "—"}
                    </td>
                    <td className="p-2 text-right text-white/40 font-mono">
                      {r.duration_ms != null ? r.duration_ms : "—"}
                    </td>
                    <td className="p-2 text-white/50 max-w-[220px] truncate" title={r.notes || ""}>
                      {r.notes || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
