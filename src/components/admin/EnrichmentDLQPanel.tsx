// Sprint G/H/K — Dead Letter Queue + Backfill admin panel.
// Shows: dead-letter rows, last canary status, alert thresholds, manual triggers.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, RefreshCw, PlayCircle, Heart, Inbox } from "lucide-react";
import { toast } from "sonner";

interface DLRow {
  id: string;
  prospect_id: string | null;
  provider: string | null;
  reason: string | null;
  attempt_count: number;
  last_attempt_at: string | null;
  last_error: string | null;
  meta: Record<string, unknown> | null;
}

interface CanaryRow {
  id: string;
  status: "pass" | "fail" | "degraded";
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

interface ReplayRow {
  id: string;
  prospect_id: string | null;
  reason: string | null;
  triggered_by: string | null;
  success: boolean | null;
  created_at: string;
}

export default function EnrichmentDLQPanel() {
  const [dlq, setDlq] = useState<DLRow[] | null>(null);
  const [canary, setCanary] = useState<CanaryRow[] | null>(null);
  const [replays, setReplays] = useState<ReplayRow[] | null>(null);
  const [agedCount, setAgedCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [dlqRes, canRes, repRes, agedRes] = await Promise.all([
      supabase.from("enrichment_dead_letter" as any)
        .select("id,prospect_id,provider,reason,attempt_count,last_attempt_at,last_error,meta")
        .order("last_attempt_at", { ascending: false })
        .limit(25),
      supabase.from("enrichment_e2e_runs" as any)
        .select("id,status,duration_ms,error,created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("enrichment_replay_log" as any)
        .select("id,prospect_id,reason,triggered_by,success,created_at")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase.from("contractor_outreach_prospects" as any)
        .select("id", { count: "exact", head: true })
        .eq("suppression_reason", "dlq_aged_unenrichable"),
    ]);
    setDlq(((dlqRes.data as unknown) as DLRow[]) ?? []);
    setCanary(((canRes.data as unknown) as CanaryRow[]) ?? []);
    setReplays(((repRes.data as unknown) as ReplayRow[]) ?? []);
    setAgedCount(agedRes.count ?? 0);
  };

  useEffect(() => { load(); }, []);

  const runBackfill = async (mode: "dry_run" | "execute", source: "no_data" | "partial" | "dlq" | "all" = "all") => {
    setBusy(`backfill_${mode}`);
    try {
      const { data, error } = await supabase.functions.invoke("contractor-outreach-enrich-backfill", {
        body: { mode, source, limit: 25 },
      });
      if (error) throw error;
      const d = data as any;
      toast.success(
        mode === "dry_run"
          ? `Dry-run: ${d?.eligible ?? 0} eligible / ${d?.total_candidates ?? 0} candidates`
          : `Backfill: ${d?.succeeded ?? 0} ok, ${d?.failed ?? 0} failed`,
      );
      await load();
    } catch (e) {
      toast.error(`Backfill failed: ${String(e).slice(0, 120)}`);
    } finally {
      setBusy(null);
    }
  };

  const runCanary = async () => {
    setBusy("canary");
    try {
      const { data, error } = await supabase.functions.invoke("enrichment-e2e-verify", { body: {} });
      if (error) throw error;
      const d = data as any;
      toast[d?.status === "pass" ? "success" : "warning"](
        `Canary: ${d?.status ?? "unknown"} (${d?.duration_ms ?? 0}ms)`,
      );
      await load();
    } catch (e) {
      toast.error(`Canary failed: ${String(e).slice(0, 120)}`);
    } finally {
      setBusy(null);
    }
  };

  const lastCanary = canary?.[0];

  return (
    <div className="space-y-4">
      {/* Health summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4" /> E2E Canary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!canary ? (
              <Skeleton className="h-8 w-24" />
            ) : lastCanary ? (
              <div className="space-y-1">
                <Badge variant={lastCanary.status === "pass" ? "default" : "destructive"}>
                  {lastCanary.status.toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {new Date(lastCanary.created_at).toLocaleString()} · {lastCanary.duration_ms ?? "?"}ms
                </p>
                {lastCanary.error && (
                  <p className="text-xs text-destructive truncate" title={lastCanary.error}>
                    {lastCanary.error}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No canary runs yet</p>
            )}
            <Button size="sm" variant="outline" className="mt-2 w-full" onClick={runCanary} disabled={busy === "canary"}>
              <PlayCircle className="h-3 w-3 mr-1" />
              {busy === "canary" ? "Running…" : "Run now"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Inbox className="h-4 w-4" /> Dead Letter Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{dlq?.length ?? "—"}</p>
            <p className="text-xs text-muted-foreground">recent failures</p>
            <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => runBackfill("dry_run", "dlq")} disabled={busy?.startsWith("backfill")}>
              Dry-run DLQ replay
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Backfill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => runBackfill("dry_run", "all")} disabled={busy?.startsWith("backfill")}>
              {busy === "backfill_dry_run" ? "Scanning…" : "Dry-run all (25)"}
            </Button>
            <Button size="sm" variant="destructive" className="w-full" onClick={() => runBackfill("execute", "all")} disabled={busy?.startsWith("backfill")}>
              {busy === "backfill_execute" ? "Replaying…" : "Execute (25)"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* DLQ table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Dead Letter Queue · 25 most recent
          </CardTitle>
          <CardDescription>Prospects that failed enrichment after retries. Auto-suppressed after 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {!dlq ? (
            <Skeleton className="h-32 w-full" />
          ) : dlq.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dead letters. ✨</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dlq.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2 p-2 rounded bg-muted/30 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{r.provider ?? "unknown"}</Badge>
                      <span className="text-muted-foreground">attempt #{r.attempt_count}</span>
                      {r.last_attempt_at && (
                        <span className="text-muted-foreground">
                          {new Date(r.last_attempt_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-muted-foreground mt-1" title={r.last_error ?? ""}>
                      {r.reason ?? r.last_error ?? "—"}
                    </p>
                  </div>
                  <code className="text-[10px] text-muted-foreground shrink-0">
                    {r.prospect_id?.slice(0, 8) ?? "—"}
                  </code>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent replays */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent replays · 15 latest</CardTitle>
        </CardHeader>
        <CardContent>
          {!replays ? (
            <Skeleton className="h-24 w-full" />
          ) : replays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No replays yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {replays.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={r.success ? "default" : "destructive"} className="text-[10px]">
                      {r.success ? "ok" : "fail"}
                    </Badge>
                    <span className="text-muted-foreground truncate">{r.reason} · {r.triggered_by}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {new Date(r.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
