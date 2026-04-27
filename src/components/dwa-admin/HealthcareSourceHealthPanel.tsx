import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

interface SourceResult {
  source: string;
  status: number;
  ok: boolean;
  elapsed_ms: number;
  error: string | null;
  inserted: number | null;
}

interface RunResult {
  ok: boolean;
  results: SourceResult[];
  baseline_count_7d: number;
  new_count_7d: number;
  delta: number;
}

export default function HealthcareSourceHealthPanel({ onRefresh }: { onRefresh?: () => void }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<RunResult | null>(null);

  async function rerun() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("healthcare-sources-rerun", {});
      if (error) throw error;
      const r = data as RunResult;
      setLast(r);
      const winners = r.results.filter(x => x.ok).length;
      const losers = r.results.length - winners;
      if (r.delta > 0) {
        toast.success(`+${r.delta} new healthcare candidates · ${winners}/${r.results.length} sources OK`);
      } else if (losers > 0) {
        toast.error(`No new candidates · ${losers}/${r.results.length} sources failed (see panel)`);
      } else {
        toast.message(`Sources OK but no new candidates yet — try again in 1 min`);
      }
      onRefresh?.();
    } catch (e: any) {
      toast.error(e?.message || "Re-run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-pink-950/20 border border-pink-500/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-pink-900/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-pink-300" />
          <span className="text-xs font-bold text-pink-200 uppercase tracking-widest">Healthcare Source Health · Why is the list empty?</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-pink-300" /> : <ChevronDown className="w-4 h-4 text-pink-300" />}
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-3 border-t border-pink-500/15">
          <p className="text-xs text-slate-300 leading-relaxed">
            Healthcare candidates (RN/CNA/LPN/Home Health) come from 3 source modules. If the Cherry-Pick widget is empty, one of them is likely broken or the cron stopped. Click <b>Re-run</b> to fire all 3 right now and see exactly which one fails — and why.
          </p>

          <button
            onClick={rerun}
            disabled={running}
            className="px-3 py-1.5 rounded-lg bg-pink-500/15 border border-pink-500/40 text-pink-200 hover:bg-pink-500/25 transition-colors text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {running ? "Running all 3 healthcare sources…" : "Re-run healthcare scrapers now"}
          </button>

          {last && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#0a1628] border border-white/10 rounded p-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Before</div>
                  <div className="text-white font-bold text-sm">{last.baseline_count_7d}</div>
                </div>
                <div className="bg-[#0a1628] border border-white/10 rounded p-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">After</div>
                  <div className="text-white font-bold text-sm">{last.new_count_7d}</div>
                </div>
                <div className={`bg-[#0a1628] border rounded p-2 ${last.delta > 0 ? "border-emerald-500/30" : "border-white/10"}`}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Δ Added</div>
                  <div className={`font-bold text-sm ${last.delta > 0 ? "text-emerald-300" : "text-slate-400"}`}>
                    {last.delta > 0 ? "+" : ""}{last.delta}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                {last.results.map(r => (
                  <div key={r.source} className={`flex items-start gap-2 px-2 py-1.5 rounded border text-xs ${r.ok ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                    {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 text-red-300 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-slate-200 text-[11px]">{r.source}</div>
                      {r.error ? (
                        <div className="text-red-300 text-[10px] mt-0.5 break-all">↳ {r.error}</div>
                      ) : (
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          {r.elapsed_ms}ms{r.inserted != null ? ` · inserted ${r.inserted}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
