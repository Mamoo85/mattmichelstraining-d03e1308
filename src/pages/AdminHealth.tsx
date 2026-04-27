import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, Activity } from "lucide-react";

interface PingResult {
  auth_ok: boolean;
  db_read_ok: boolean;
  db_write_ok: boolean;
  latency_ms: number;
  error_message?: string | null;
  timestamp: string;
}

interface HistoryRow {
  id: string;
  auth_ok: boolean;
  db_read_ok: boolean;
  db_write_ok: boolean;
  latency_ms: number | null;
  created_at: string;
}

const StatusDot = ({ ok }: { ok: boolean }) =>
  ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />;

export default function AdminHealth() {
  const [live, setLive] = useState<PingResult | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [running, setRunning] = useState(false);

  const runCheck = async () => {
    setRunning(true);
    try {
      const { data } = await supabase.functions.invoke("health-check-supabase");
      if (data) setLive(data as PingResult);
      const { data: h } = await supabase
        .from("health_check_pings" as any)
        .select("id, auth_ok, db_read_ok, db_write_ok, latency_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (h) setHistory(h as unknown as HistoryRow[]);
    } catch {
      /* noop */
    }
    setRunning(false);
  };

  useEffect(() => {
    runCheck();
  }, []);

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" /> Supabase Connectivity
        </h1>
        <button
          onClick={runCheck}
          disabled={running}
          className="px-4 py-2 bg-primary text-primary-foreground rounded font-bold text-sm disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Run Check"}
        </button>
      </div>

      {live && (
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div className="text-xs text-muted-foreground font-mono">
            Last ping: {new Date(live.timestamp).toLocaleString()} · {live.latency_ms}ms
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <StatusDot ok={live.auth_ok} /> Auth
            </div>
            <div className="flex items-center gap-2">
              <StatusDot ok={live.db_read_ok} /> DB Read
            </div>
            <div className="flex items-center gap-2">
              <StatusDot ok={live.db_write_ok} /> DB Write
            </div>
          </div>
          {live.error_message && (
            <div className="text-xs text-destructive font-mono">{live.error_message}</div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Recent History ({history.length})
        </h2>
        <div className="border border-border rounded-lg divide-y divide-border bg-card text-xs font-mono">
          {history.map((h) => (
            <div key={h.id} className="px-3 py-2 flex items-center gap-3">
              <span className="text-muted-foreground w-40">
                {new Date(h.created_at).toLocaleString()}
              </span>
              <StatusDot ok={h.auth_ok} />
              <StatusDot ok={h.db_read_ok} />
              <StatusDot ok={h.db_write_ok} />
              <span className="ml-auto text-muted-foreground">{h.latency_ms ?? "-"}ms</span>
            </div>
          ))}
          {history.length === 0 && (
            <div className="px-3 py-6 text-center text-muted-foreground">No checks recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
