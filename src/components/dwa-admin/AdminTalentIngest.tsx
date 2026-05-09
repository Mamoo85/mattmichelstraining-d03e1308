import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SCANNER_SOURCES = ["fmcsa_safer", "npi_registry", "talent-radar-cdl-scanner", "talent-radar-nurse-scanner"];

export default function AdminTalentIngest() {
  const { toast } = useToast();

  const { data: runs, refetch } = useQuery({
    queryKey: ["talent-ingest-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hire_alert_runs" as any)
        .select("id, source, source_label, started_at, completed_at, candidates_found, new_candidates, merged, rejected, skipped, candidates_alerted, status, replay_url, errors_detail")
        .in("source", SCANNER_SOURCES)
        .order("started_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: multi } = useQuery({
    queryKey: ["talent-ingest-multisource"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hire_alert_candidates" as any)
        .select("id, sources")
        .limit(2000);
      return (data || []).filter((c: any) => Array.isArray(c.sources) && c.sources.length > 1).length;
    },
  });

  async function replay(replay_url: string | null) {
    if (!replay_url) return;
    const { error } = await supabase.functions.invoke(replay_url, { body: { dry_run: false } });
    if (error) toast({ title: "Replay failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Replay started", description: replay_url }); refetch(); }
  }

  return (
    <div className="space-y-4 text-white">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-xs text-white/50 uppercase">Runs (last 50)</div>
          <div className="text-2xl font-bold">{runs?.length ?? "—"}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-xs text-white/50 uppercase">Multi-source candidates</div>
          <div className="text-2xl font-bold text-emerald-400">{multi ?? "—"}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-xs text-white/50 uppercase">Sources</div>
          <div className="text-sm">{SCANNER_SOURCES.join(", ")}</div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="text-left p-2">Source</th>
              <th className="text-left p-2">Started</th>
              <th className="text-right p-2">Found</th>
              <th className="text-right p-2">New</th>
              <th className="text-right p-2">Merged</th>
              <th className="text-right p-2">Rejected</th>
              <th className="text-right p-2">Hot 🔥</th>
              <th className="text-left p-2">Status</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {(runs || []).map((r: any) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-2">{r.source_label || r.source}</td>
                <td className="p-2 text-white/60">{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</td>
                <td className="p-2 text-right">{r.candidates_found ?? 0}</td>
                <td className="p-2 text-right text-emerald-400">{r.new_candidates ?? 0}</td>
                <td className="p-2 text-right text-cyan-400">{r.merged ?? 0}</td>
                <td className="p-2 text-right text-amber-400">{r.rejected ?? 0}</td>
                <td className="p-2 text-right">{r.candidates_alerted ?? 0}</td>
                <td className="p-2">
                  <span className={r.status === "completed" ? "text-emerald-400" : r.status === "completed_with_errors" ? "text-amber-400" : "text-white/60"}>
                    {r.status || "—"}
                  </span>
                </td>
                <td className="p-2">
                  {r.replay_url && (
                    <Button size="sm" variant="ghost" onClick={() => replay(r.replay_url)}>Replay</Button>
                  )}
                </td>
              </tr>
            ))}
            {(!runs || runs.length === 0) && (
              <tr><td colSpan={9} className="p-6 text-center text-white/40">No runs yet. Trigger a scanner to populate.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
