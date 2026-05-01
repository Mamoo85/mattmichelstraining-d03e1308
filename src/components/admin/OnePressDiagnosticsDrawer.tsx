import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Play } from "lucide-react";
import { toast } from "sonner";

interface QueueRow {
  id: string;
  channel: string;
  status: string;
  attempts: number;
  prospect_id: string | null;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
}

interface AuditRow {
  id: string;
  channel: string;
  event: string;
  reason: string | null;
  created_at: string;
}

interface Props {
  runId: string | null;
  stageProgress: Record<string, unknown> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetryRun?: (runId: string) => void;
}

export default function OnePressDiagnosticsDrawer({ runId, stageProgress, open, onOpenChange, onRetryRun }: Props) {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draining, setDraining] = useState(false);

  useEffect(() => {
    if (!open || !runId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: q }, { data: a }] = await Promise.all([
          supabase
            .from("outreach_send_queue")
            .select("id, channel, status, attempts, prospect_id, last_error, sent_at, created_at")
            .eq("source_run_id", runId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("contractor_outreach_audit_log")
            .select("id, channel, event, reason, created_at")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
        if (!cancelled) {
          setQueue((q as QueueRow[]) || []);
          setAudit((a as AuditRow[]) || []);
        }
      } catch (err) {
        console.error("[diagnostics] load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, runId]);

  const runWorkerNow = async () => {
    setDraining(true);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-queue-worker", {
        body: { trigger: "manual-diagnostics", run_id: runId },
      });
      if (error) throw error;
      const stats = (data as any)?.stats || {};
      toast.success(`Worker drained: ${stats.sent || 0} sent · ${stats.failed || 0} failed · ${stats.claimed || 0} claimed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Worker failed");
    } finally {
      setDraining(false);
    }
  };

  const statusColor = (s: string) =>
    s === "sent" ? "bg-emerald-100 text-emerald-800"
    : s === "failed" || s === "dead" ? "bg-rose-100 text-rose-800"
    : s === "claimed" ? "bg-amber-100 text-amber-800"
    : "bg-slate-100 text-slate-700";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>One-Press diagnostics</SheetTitle>
          <SheetDescription className="text-xs font-mono break-all">{runId || "—"}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={runWorkerNow} disabled={draining || !runId}>
            {draining ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            Run worker now
          </Button>
          {onRetryRun && runId && (
            <Button size="sm" variant="outline" onClick={() => onRetryRun(runId)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry failed stage
            </Button>
          )}
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <h3 className="text-sm font-semibold mb-2">Stage progress</h3>
            <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-x-auto max-h-48">
              {JSON.stringify(stageProgress || {}, null, 2)}
            </pre>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">
              Send queue (this run) {loading && <Loader2 className="h-3 w-3 inline animate-spin ml-1" />}
            </h3>
            {queue.length === 0 ? (
              <p className="text-xs text-muted-foreground">No queue rows linked to this run yet.</p>
            ) : (
              <div className="space-y-1.5">
                {queue.map((q) => (
                  <div key={q.id} className="rounded border p-2 text-[11px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={statusColor(q.status)}>{q.status}</Badge>
                      <span className="font-mono">{q.channel}</span>
                      <span className="text-muted-foreground">attempts {q.attempts}</span>
                      <span className="text-muted-foreground ml-auto">{new Date(q.created_at).toLocaleTimeString()}</span>
                    </div>
                    {q.last_error && <div className="mt-1 text-rose-700 break-all">{q.last_error}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Recent outreach audit (last 20)</h3>
            {audit.length === 0 ? (
              <p className="text-xs text-muted-foreground">No audit rows.</p>
            ) : (
              <div className="space-y-1.5">
                {audit.map((a) => (
                  <div key={a.id} className="rounded border p-2 text-[11px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{a.event}</Badge>
                      <span className="font-mono">{a.channel}</span>
                      <span className="text-muted-foreground ml-auto">{new Date(a.created_at).toLocaleTimeString()}</span>
                    </div>
                    {a.reason && <div className="mt-1 text-muted-foreground break-all">{a.reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
