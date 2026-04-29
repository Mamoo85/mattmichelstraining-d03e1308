import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw } from "lucide-react";

interface HealthEvent {
  id: string;
  function_name: string;
  http_status: number;
  ok: boolean;
  latency_ms: number;
  error: string | null;
  created_at: string;
}

export default function AdminEdgeHealth() {
  const [rows, setRows] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const { data } = await (supabase.from as any)("edge_health_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("edge_health_live").on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "edge_health_events" },
      () => load(),
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const runCheck = async () => {
    setRunning(true);
    try {
      await supabase.functions.invoke("edge-function-health-check");
      await load();
    } finally {
      setRunning(false);
    }
  };

  // Group latest by function
  const latest = new Map<string, HealthEvent>();
  for (const r of rows) if (!latest.has(r.function_name)) latest.set(r.function_name, r);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <h1 className="text-2xl font-bold">Edge Function Health</h1>
        </div>
        <Button onClick={runCheck} disabled={running} size="sm">
          <RefreshCw className={`w-4 h-4 mr-1 ${running ? "animate-spin" : ""}`} /> Run check
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {Array.from(latest.values()).map((r) => (
            <Card key={r.function_name} className="p-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm">{r.function_name}</div>
                <Badge variant={r.ok ? "outline" : "destructive"}>
                  {r.ok ? "OK" : "FAIL"} {r.http_status || ""}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {r.latency_ms}ms · {new Date(r.created_at).toLocaleTimeString()}
              </div>
              {r.error && <div className="text-xs text-rose-400 mt-1 truncate">{r.error}</div>}
            </Card>
          ))}
        </div>
      )}

      <Card className="p-3">
        <div className="text-sm font-semibold mb-2">Recent events ({rows.length})</div>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs border-b border-border/20 py-1">
              <span className="font-mono">{r.function_name}</span>
              <span className={r.ok ? "text-emerald-400" : "text-rose-400"}>{r.http_status} · {r.latency_ms}ms</span>
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
