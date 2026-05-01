import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, Loader2, CheckCircle2, XCircle, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import OnePressDiagnosticsDrawer from "./OnePressDiagnosticsDrawer";

/**
 * OneePressLauncher
 * Single-button orchestrator for the full Scrape → Enrich → Score → Send pipeline.
 * Subscribes to Supabase Realtime on `outreach_one_press_runs` to show live progress
 * — no polling, no refresh button needed.
 */

interface RunRow {
  id: string;
  status: string;
  stage: string;
  trades: string[];
  cities: string[];
  channels: string[];
  scraped_count: number;
  enriched_count: number;
  scored_count: number;
  sent_count: number;
  failed_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  stage_progress: Record<string, unknown> | null;
  min_quality_score?: number;
}

interface Props {
  trades: string[];
  cities: string[];
  channels?: ("email" | "sms")[];
  maxProspects?: number;
  minQualityScore?: number;
  disabled?: boolean;
}

const STAGE_PCT: Record<string, number> = {
  queued: 5, scraping: 20, enriching: 45, scoring: 70, sending: 90, completed: 100, failed: 100,
};

const STAGE_LABEL: Record<string, string> = {
  queued: "Queued…",
  scraping: "Scraping prospects from Google Places…",
  enriching: "Enriching contacts (Snov → Apollo → PDL)…",
  scoring: "Computing quality scores…",
  sending: "Sending outreach…",
  completed: "Complete",
  failed: "Failed",
};

export default function OnePressLauncher({
  trades, cities, channels = ["email"], maxProspects = 50, minQualityScore = 50, disabled,
}: Props) {
  const [run, setRun] = useState<RunRow | null>(null);
  const [launching, setLaunching] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to realtime when we have an active run
  useEffect(() => {
    if (!run?.id) return;

    const ch = supabase
      .channel(`one-press-${run.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "outreach_one_press_runs", filter: `id=eq.${run.id}` },
        (payload) => setRun(payload.new as RunRow))
      .subscribe();

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [run?.id]);

  const launch = async () => {
    if (!trades.length || !cities.length) {
      toast.error("Pick at least one trade and one city first");
      return;
    }
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-one-press", {
        body: { trades, cities, channels, max_prospects: maxProspects, min_quality_score: minQualityScore },
      });
      if (error) throw error;
      const runId = (data as { run_id?: string })?.run_id;
      if (!runId) throw new Error("No run_id returned");

      const { data: row, error: fetchErr } = await supabase
        .from("outreach_one_press_runs").select("*").eq("id", runId).single();
      if (fetchErr) throw fetchErr;
      setRun(row as RunRow);
      toast.success("One-Press run launched — watching live progress");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  };

  const done = run?.status === "completed" || run?.status === "failed";
  const pct = run ? (STAGE_PCT[run.stage] ?? 0) : 0;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-primary" /> One-Press Outreach
        </CardTitle>
        <CardDescription className="text-xs">
          Scrape → Enrich → Score → Send in one click. Live progress via Realtime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1 text-xs">
          {trades.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
          {cities.map(c => <Badge key={c} variant="outline">{c}</Badge>)}
          <Badge variant="outline">max {maxProspects}</Badge>
          <Badge variant="outline">min Q {minQualityScore}</Badge>
        </div>

        {!run && (
          <Button onClick={launch} disabled={disabled || launching || !trades.length || !cities.length} className="w-full">
            {launching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Launching…</> : <><Zap className="h-4 w-4 mr-2" /> Launch One-Press Run</>}
          </Button>
        )}

        {run && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-1.5">
                {done
                  ? (run.status === "completed"
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      : <XCircle className="h-3.5 w-3.5 text-rose-600" />)
                  : <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                {STAGE_LABEL[run.stage] || run.stage}
              </span>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <Progress value={pct} />

            <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
              <div className="rounded border p-1.5">
                <div className="text-muted-foreground">Scraped</div>
                <div className="font-semibold">{run.scraped_count}</div>
              </div>
              <div className="rounded border p-1.5">
                <div className="text-muted-foreground">Enriched</div>
                <div className="font-semibold">{run.enriched_count}</div>
              </div>
              <div className="rounded border p-1.5">
                <div className="text-muted-foreground">Eligible</div>
                <div className="font-semibold">{run.scored_count}</div>
              </div>
              <div className="rounded border p-1.5">
                <div className="text-muted-foreground">Sent</div>
                <div className="font-semibold">{run.sent_count}</div>
              </div>
            </div>

            {run.failed_count > 0 && (
              <div className="text-xs text-amber-700">⚠ {run.failed_count} failures — see diagnostics drawer.</div>
            )}
            {run.error_message && (
              <div className="text-xs text-rose-700 rounded border border-rose-300 bg-rose-50 p-2 whitespace-pre-wrap">{run.error_message}</div>
            )}
            {(() => {
              const sp: any = run.stage_progress || {};
              const sendErrs: string[] = Array.isArray(sp.send_errors) ? sp.send_errors : [];
              const scrapeErrs: string[] = Array.isArray(sp.scrape_errors) ? sp.scrape_errors : [];
              const queued = typeof sp.queued === "number" ? sp.queued : 0;
              const eq = typeof sp.effective_quality === "number" ? sp.effective_quality : null;
              return (
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  {queued > 0 && <div className="text-emerald-700">✓ {queued} prospects queued for background sender (worker triggered)</div>}
                  {eq != null && eq !== run.min_quality_score && <div>Auto-relaxed quality threshold to {eq} (no eligible at requested level)</div>}
                  {sp.fallback && <div>📍 {String(sp.fallback)}</div>}
                  {sendErrs.length > 0 && (
                    <details className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
                      <summary className="cursor-pointer font-semibold">Send blockers ({sendErrs.length})</summary>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">{sendErrs.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </details>
                  )}
                  {scrapeErrs.length > 0 && (
                    <details className="rounded border border-slate-300 bg-slate-50 p-2 text-slate-700">
                      <summary className="cursor-pointer font-semibold">Scrape errors ({scrapeErrs.length})</summary>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">{scrapeErrs.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </details>
                  )}
                </div>
              );
            })()}

            {done && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setRun(null)}>
                Start another run
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
