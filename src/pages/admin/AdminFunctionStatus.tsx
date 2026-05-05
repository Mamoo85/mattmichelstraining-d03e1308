import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface CronRow {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_duration_s: number | null;
}
interface HealthRow {
  function_name: string;
  ok: boolean;
  http_status: number;
  latency_ms: number;
  error: string | null;
  created_at: string;
}
interface ErrorRow {
  function_name: string | null;
  severity: string | null;
  error_message: string | null;
  created_at: string;
}

interface FnStatus {
  name: string;
  schedule: string | null;
  active: boolean | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastDurationS: number | null;
  lastHealthAt: string | null;
  lastHealthOk: boolean | null;
  lastHealthError: string | null;
  errors24h: number;
  errors7d: number;
  lastErrorMessage: string | null;
}

const cronJobToFunction = (jobname: string): string => {
  // Cron job names are typically `<function-name>-<freq>` or just `<function-name>`
  return jobname.replace(/-(daily|hourly|weekly|every-\w+|cron|sched(ule)?)$/i, "");
};

export default function AdminFunctionStatus() {
  const [crons, setCrons] = useState<CronRow[]>([]);
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "failing" | "ok" | "stale">("all");

  const load = async () => {
    setLoading(true);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [c, h, e] = await Promise.all([
      (supabase.from as any)("cron_run_status").select("*").order("last_run_at", { ascending: false }),
      (supabase.from as any)("edge_health_events")
        .select("function_name,ok,http_status,latency_ms,error,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      (supabase.from as any)("error_logs")
        .select("function_name,severity,error_message,created_at")
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    setCrons(c.data || []);
    setHealth(h.data || []);
    setErrors(e.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("fn-status-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "edge_health_events" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "error_logs" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
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

  const rows: FnStatus[] = useMemo(() => {
    const map = new Map<string, FnStatus>();
    const ensure = (name: string): FnStatus => {
      if (!map.has(name)) {
        map.set(name, {
          name,
          schedule: null,
          active: null,
          lastRunAt: null,
          lastStatus: null,
          lastDurationS: null,
          lastHealthAt: null,
          lastHealthOk: null,
          lastHealthError: null,
          errors24h: 0,
          errors7d: 0,
          lastErrorMessage: null,
        });
      }
      return map.get(name)!;
    };

    for (const c of crons) {
      const name = cronJobToFunction(c.jobname);
      const r = ensure(name);
      // Keep most recent run if multiple cron jobs map to same function
      if (!r.lastRunAt || (c.last_run_at && c.last_run_at > r.lastRunAt)) {
        r.lastRunAt = c.last_run_at;
        r.lastStatus = c.last_status;
        r.lastDurationS = c.last_duration_s;
      }
      r.schedule = r.schedule ? `${r.schedule}, ${c.schedule}` : c.schedule;
      r.active = c.active;
    }

    for (const h of health) {
      const r = ensure(h.function_name);
      if (!r.lastHealthAt || h.created_at > r.lastHealthAt) {
        r.lastHealthAt = h.created_at;
        r.lastHealthOk = h.ok;
        r.lastHealthError = h.error;
      }
    }

    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    for (const e of errors) {
      if (!e.function_name) continue;
      const r = ensure(e.function_name);
      r.errors7d += 1;
      if (new Date(e.created_at).getTime() >= cutoff24h) r.errors24h += 1;
      if (!r.lastErrorMessage) r.lastErrorMessage = e.error_message;
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.errors24h !== a.errors24h) return b.errors24h - a.errors24h;
      const at = a.lastRunAt || a.lastHealthAt || "";
      const bt = b.lastRunAt || b.lastHealthAt || "";
      return bt.localeCompare(at);
    });
  }, [crons, health, errors]);

  const STALE_MS = 26 * 60 * 60 * 1000;
  const filtered = rows.filter((r) => {
    if (filter && !r.name.toLowerCase().includes(filter.toLowerCase())) return false;
    const lastTs = r.lastRunAt || r.lastHealthAt;
    const stale = lastTs ? Date.now() - new Date(lastTs).getTime() > STALE_MS : true;
    const failing = r.errors24h > 0 || r.lastHealthOk === false || r.lastStatus === "failed";
    if (statusFilter === "failing") return failing;
    if (statusFilter === "ok") return !failing && !stale;
    if (statusFilter === "stale") return stale && !failing;
    return true;
  });

  const totals = {
    total: rows.length,
    failing: rows.filter((r) => r.errors24h > 0 || r.lastHealthOk === false || r.lastStatus === "failed").length,
    errors24h: rows.reduce((s, r) => s + r.errors24h, 0),
    errors7d: rows.reduce((s, r) => s + r.errors7d, 0),
  };

  const fmt = (ts: string | null) => {
    if (!ts) return "—";
    const d = new Date(ts);
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 60 / 24)}d ago`;
  };

  const statusBadge = (r: FnStatus) => {
    if (r.errors24h > 0) return <Badge variant="destructive" className="text-[10px]">{r.errors24h} err 24h</Badge>;
    if (r.lastHealthOk === false || r.lastStatus === "failed")
      return <Badge variant="destructive" className="text-[10px]">FAIL</Badge>;
    const lastTs = r.lastRunAt || r.lastHealthAt;
    if (!lastTs) return <Badge variant="outline" className="text-[10px]">No data</Badge>;
    if (Date.now() - new Date(lastTs).getTime() > STALE_MS)
      return <Badge className="bg-yellow-600 text-white text-[10px]">Stale</Badge>;
    return <Badge className="bg-green-600 text-white text-[10px]">OK</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <h1 className="text-2xl font-bold">Edge Function Status</h1>
        </div>
        <Button onClick={runCheck} disabled={running} size="sm">
          <RefreshCw className={`w-4 h-4 mr-1 ${running ? "animate-spin" : ""}`} /> Run health check
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Card className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Functions</p>
          <p className="text-2xl font-bold">{totals.total}</p>
        </Card>
        <Card className="p-3 text-center border-destructive/30">
          <p className="text-[10px] text-destructive uppercase">Failing</p>
          <p className="text-2xl font-bold text-destructive">{totals.failing}</p>
        </Card>
        <Card className="p-3 text-center border-yellow-600/30">
          <p className="text-[10px] text-yellow-400 uppercase">Errors 24h</p>
          <p className="text-2xl font-bold text-yellow-400">{totals.errors24h}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Errors 7d</p>
          <p className="text-2xl font-bold">{totals.errors7d}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <Input
          placeholder="Filter by function name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs h-8 text-xs"
        />
        {(["all", "failing", "ok", "stale"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className="h-8 text-xs capitalize"
          >
            {s}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} shown</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No functions match the current filter.</Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((r) => (
            <Card key={r.name} className="p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(r)}
                    <span className="font-mono text-sm truncate">{r.name}</span>
                    {r.schedule && (
                      <span className="text-[10px] text-muted-foreground font-mono">{r.schedule}</span>
                    )}
                    {r.active === false && (
                      <Badge variant="outline" className="text-[10px]">disabled</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Last run: {fmt(r.lastRunAt)}
                      {r.lastDurationS != null && ` · ${r.lastDurationS}s`}
                    </span>
                    <span className="flex items-center gap-1">
                      {r.lastHealthOk === false ? (
                        <AlertTriangle className="w-3 h-3 text-destructive" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      )}
                      Health: {fmt(r.lastHealthAt)}
                    </span>
                    {r.errors7d > 0 && <span>7d errors: {r.errors7d}</span>}
                  </div>
                  {(r.lastHealthError || r.lastErrorMessage) && (
                    <p className="text-[11px] text-destructive mt-1 truncate">
                      {r.lastHealthError || r.lastErrorMessage}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
