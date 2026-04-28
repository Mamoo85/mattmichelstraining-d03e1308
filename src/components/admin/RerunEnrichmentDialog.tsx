import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Progress {
  progress_id: string;
  step: string;
  total: number;
  processed: number;
  done: boolean;
  meta: any;
  message: string | null;
}

export default function RerunEnrichmentDialog() {
  const [limit, setLimit] = useState("100");
  const [minC, setMinC] = useState("");
  const [maxC, setMaxC] = useState("");
  const [trade, setTrade] = useState("");
  const [city, setCity] = useState("");
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    if (!runId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("enrichment_run_progress")
        .select("progress_id, step, total, processed, done, meta, message")
        .eq("progress_id", runId)
        .maybeSingle();
      if (data) {
        setProgress(data as Progress);
        if ((data as any).done) {
          clearInterval(interval);
          setRunning(false);
          toast.success((data as any).message || "Re-run complete");
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [runId]);

  async function start() {
    setRunning(true);
    setProgress(null);
    setRunId(null);
    const body: any = { limit: Number(limit) };
    if (minC) body.minConfidence = Number(minC);
    if (maxC) body.maxConfidence = Number(maxC);
    if (trade) body.trade = trade;
    if (city) body.city = city;
    const { data, error } = await supabase.functions.invoke("enrichment-rerun-batch", { body });
    if (error) {
      toast.error(error.message);
      setRunning(false);
      return;
    }
    setRunId(data?.run_id);
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Play className="w-5 h-5" />
        <h3 className="font-semibold">Re-run Enrichment (lowest confidence first)</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <Label>Limit</Label>
          <Input value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
        <div>
          <Label>Min confidence</Label>
          <Input value={minC} onChange={(e) => setMinC(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label>Max confidence</Label>
          <Input value={maxC} onChange={(e) => setMaxC(e.target.value)} placeholder="100" />
        </div>
        <div>
          <Label>Trade</Label>
          <Input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="optional" />
        </div>
        <div>
          <Label>City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="optional" />
        </div>
      </div>
      <Button onClick={start} disabled={running}>
        {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Start re-run
      </Button>
      {progress && (
        <div className="text-sm space-y-1 bg-muted/40 rounded p-3">
          <div className="flex justify-between">
            <span>Status: {progress.step}</span>
            <span>
              {progress.processed} / {progress.total}
            </span>
          </div>
          <div className="h-2 bg-muted rounded overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress.total ? (progress.processed / progress.total) * 100 : 0}%` }}
            />
          </div>
          {progress.meta && (
            <div className="text-xs text-muted-foreground">
              Updated: {progress.meta.updated ?? 0} · Skipped: {progress.meta.skipped ?? 0} · Suppressed: {progress.meta.suppressed ?? 0}
            </div>
          )}
          {progress.message && <div className="text-xs font-semibold">{progress.message}</div>}
        </div>
      )}
    </Card>
  );
}
