import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingDown, AlertTriangle, ChevronRight, ChevronDown, ExternalLink } from "lucide-react";

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
  raw_payload?: any;
}

interface RunRow {
  id: string;
  run_at: string;
  source: string;
  signals_found: number | null;
  signals_new: number | null;
  status: string | null;
  errors: string | null;
  duration_ms: number | null;
}

interface Props {
  scannerFilter?: string[];
}

export default function WaterfallDiagnostics({ scannerFilter }: Props) {
  const [rows, setRows] = useState<RawDumpRow[]>([]);
  const [runMap, setRunMap] = useState<Record<string, RunRow>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    let q = supabase
      .from("raw_signals_dump" as any)
      .select("id, scanner, source, vertical, fetched_at, pulled_count, kept_after_gate, enriched_count, final_inserted, ai_cost_usd, duration_ms, notes, raw_payload")
      .order("fetched_at", { ascending: false })
      .limit(50);
    if (scannerFilter?.length) q = q.in("scanner", scannerFilter);
    const { data, error } = await q;
    if (error) setErr(error.message);
    const dumpRows = ((data as any) || []) as RawDumpRow[];
    setRows(dumpRows);

    // Cross-reference matching demand_radar_runs (by scanner name + nearby timestamp)
    if (dumpRows.length) {
      const earliest = dumpRows[dumpRows.length - 1].fetched_at;
      const sources = Array.from(new Set(dumpRows.map((r) => r.scanner)));
      const { data: runs } = await supabase
        .from("demand_radar_runs" as any)
        .select("id, run_at, source, signals_found, signals_new, status, errors, duration_ms")
        .in("source", sources)
        .gte("run_at", earliest);
      const map: Record<string, RunRow> = {};
      ((runs as any[]) || []).forEach((run: RunRow) => {
        const dumpRow = dumpRows.find(
          (d) =>
            d.scanner === run.source &&
            Math.abs(new Date(d.fetched_at).getTime() - new Date(run.run_at).getTime()) < 90_000,
        );
        if (dumpRow && !map[dumpRow.id]) map[dumpRow.id] = run;
      });
      setRunMap(map);
    }

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
          Waterfall drop-off per scanner run · last 50 · times in ET · click any row for details ·{" "}
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
                <th className="w-6"></th>
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
                const isOpen = expanded === r.id;
                const run = runMap[r.id];
                const hasError = run?.status === "error" || !!run?.errors;
                return (
                  <Fragment key={r.id}>
                    <tr
                      className={`border-t border-white/5 cursor-pointer transition-colors ${
                        isOpen ? "bg-[#00d4ff]/5" : "hover:bg-white/5"
                      } ${hasError && !isOpen ? "bg-rose-500/5" : ""}`}
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                    >
                      <td className="p-2 text-white/40">
                        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </td>
                      <td className="p-2 text-white/70">{fmtTime(r.fetched_at)}</td>
                      <td className="p-2 text-[#00d4ff]">
                        {r.scanner.replace("-scanner", "")}
                        {hasError && <span className="ml-1 text-rose-400" title={run?.errors || "error"}>⚠</span>}
                      </td>
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
                    {isOpen && (
                      <tr className="border-t border-white/5 bg-black/40">
                        <td colSpan={11} className="p-4">
                          <RunDetail row={r} run={run} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RunDetail({ row, run }: { row: RawDumpRow; run?: RunRow }) {
  const payload = row.raw_payload || {};
  const perAgency = payload?.per_agency as Record<string, { found: number; new: number; status: number; auth?: string }> | undefined;
  const errs = payload?.errors as string[] | undefined;
  const errorText = run?.errors || "";
  const looksLikeAuth = /auth|oauth|token|401|403|credential|secret|api[_ ]?key/i.test(errorText);

  return (
    <div className="space-y-3 text-xs">
      {run && (
        <div className="flex flex-wrap gap-3 text-white/70">
          <span><span className="text-white/40">Status:</span> <span className={
            run.status === "ok" ? "text-emerald-400 font-bold" :
            run.status === "error" ? "text-rose-400 font-bold" :
            "text-amber-400 font-bold"
          }>{run.status || "—"}</span></span>
          <span><span className="text-white/40">Found:</span> <span className="text-white font-bold">{run.signals_found ?? 0}</span></span>
          <span><span className="text-white/40">New:</span> <span className="text-white font-bold">{run.signals_new ?? 0}</span></span>
          {run.duration_ms != null && <span><span className="text-white/40">Duration:</span> {run.duration_ms}ms</span>}
        </div>
      )}

      {errorText && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-3">
          <div className="text-rose-300 font-bold mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Run error
          </div>
          <div className="text-rose-200/90 font-mono text-[11px] break-all">{errorText}</div>
          {looksLikeAuth && (
            <div className="mt-2 text-amber-200 text-[11px]">
              💡 Likely cause: API credentials missing, invalid, or required parameter omitted. Check Lovable Cloud secrets for this scanner.
            </div>
          )}
        </div>
      )}

      {perAgency && (
        <div>
          <div className="text-white/60 font-bold mb-1.5">Per-agency / per-source breakdown</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {Object.entries(perAgency).map(([agency, stats]) => (
              <div key={agency} className={`rounded border px-2 py-1.5 ${
                stats.status === 200 ? "border-emerald-500/30 bg-emerald-500/5" :
                stats.status === 401 || stats.status === 403 ? "border-amber-500/30 bg-amber-500/5" :
                "border-rose-500/30 bg-rose-500/5"
              }`}>
                <div className="text-white font-mono text-[11px]">{agency}</div>
                <div className="text-white/60 text-[10px]">
                  found {stats.found} · new {stats.new} · http {stats.status}
                  {stats.auth && <span className="text-rose-300 ml-1">({stats.auth})</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {errs && errs.length > 0 && (
        <div>
          <div className="text-white/60 font-bold mb-1.5">Source errors</div>
          <div className="space-y-1">
            {errs.map((e, i) => (
              <div key={i} className="font-mono text-[11px] text-rose-300/90 break-all">• {e}</div>
            ))}
          </div>
        </div>
      )}

      {row.notes && !perAgency && (
        <div>
          <div className="text-white/60 font-bold mb-1">Notes</div>
          <div className="text-white/70 font-mono text-[11px]">{row.notes}</div>
        </div>
      )}

      <div className="pt-2 border-t border-white/10 flex flex-wrap gap-3 text-[11px] text-white/40">
        <span>Dump ID: <span className="font-mono">{row.id.slice(0, 8)}…</span></span>
        {run && <span>Run ID: <span className="font-mono">{run.id.slice(0, 8)}…</span></span>}
        <a
          href={`https://supabase.com/dashboard/project/eauvubfpanpeuxsrqesu/functions/${row.scanner}/logs`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[#00d4ff] hover:underline flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          View function logs <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
