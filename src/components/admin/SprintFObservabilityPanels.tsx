import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Server,
  Map,
  DollarSign,
  Download,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface ProviderHealthRow {
  provider: string;
  calls_24h: number;
  hits_24h: number;
  errors_24h: number;
  success_rate_pct: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  max_ms: number | null;
}

interface BacklogRow {
  send_queue_overdue_1h: number;
  send_queue_overdue_24h: number;
  send_queue_stuck_claimed: number;
  send_queue_dead_total: number;
  statewide_unenriched_total: number;
  statewide_unenriched_48h: number;
  unhandled_replies_6h: number;
  bounces_24h: number;
}

interface TerritoryRow {
  trade: string;
  city: string;
  prospects: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  send_rate_pct: number | null;
  reply_rate_pct: number | null;
  bounce_rate_pct: number | null;
  last_sent_at: string | null;
  last_replied_at: string | null;
  flag_no_sends: boolean;
  flag_no_replies: boolean;
  flag_high_bounce: boolean;
}

interface CostRow {
  day: string;
  provider: string;
  unit: string;
  units_total: number;
  cost_usd_total: number | null;
  event_count: number;
}

const BACKLOG_THRESHOLDS: Partial<Record<keyof BacklogRow, number>> = {
  send_queue_overdue_1h: 50,
  send_queue_overdue_24h: 1,
  send_queue_stuck_claimed: 5,
  statewide_unenriched_48h: 100,
  unhandled_replies_6h: 1,
  bounces_24h: 20,
};

export default function SprintFObservabilityPanels() {
  const [providers, setProviders] = useState<ProviderHealthRow[]>([]);
  const [backlog, setBacklog] = useState<BacklogRow | null>(null);
  const [territory, setTerritory] = useState<TerritoryRow[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [pingingWatchdog, setPingingWatchdog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, bRes, tRes, cRes] = await Promise.all([
      supabase.from("outreach_provider_health_24h" as any).select("*"),
      supabase.from("outreach_backlog_health" as any).select("*").maybeSingle(),
      supabase.from("outreach_territory_funnel_30d" as any).select("*").limit(500),
      supabase.from("provider_cost_daily_14d" as any).select("*"),
    ]);
    setProviders((pRes.data as unknown as ProviderHealthRow[]) ?? []);
    setBacklog((bRes.data as unknown as BacklogRow) ?? null);
    setTerritory((tRes.data as unknown as TerritoryRow[]) ?? []);
    setCosts((cRes.data as unknown as CostRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredTerritory = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return territory;
    return territory.filter(
      (r) => r.trade.toLowerCase().includes(q) || r.city.toLowerCase().includes(q),
    );
  }, [territory, filter]);

  const deadZones = useMemo(
    () => territory.filter((r) => r.flag_no_sends || r.flag_no_replies || r.flag_high_bounce),
    [territory],
  );

  const exportTerritoryCsv = () => {
    const rows = filteredTerritory;
    const header = [
      "trade","city","prospects","sent","opened","clicked","replied","bounced",
      "send_rate_pct","reply_rate_pct","bounce_rate_pct",
      "last_sent_at","last_replied_at","flag_no_sends","flag_no_replies","flag_high_bounce",
    ];
    const csv = [
      header.join(","),
      ...rows.map((r) => header.map((h) => {
        const v = (r as Record<string, unknown>)[h];
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return /[,"\n]/.test(s) ? `"${s}"` : s;
      }).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach-territory-funnel-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pingWatchdog = async () => {
    setPingingWatchdog(true);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-backlog-watchdog", {
        body: { trigger: "manual" },
      });
      if (error) throw error;
      const breaches = (data?.breaches ?? []) as string[];
      if (breaches.length === 0) toast.success("Watchdog: no thresholds breached");
      else toast.warning(`Watchdog: ${breaches.length} breach(es)${data?.alerted ? " — SMS sent" : " (cooldown active)"}`);
    } catch (e) {
      toast.error(`Watchdog ping failed: ${(e as Error).message}`);
    } finally {
      setPingingWatchdog(false);
    }
  };

  // ── COSTS rollup by provider (14d) ──
  const costsByProvider = useMemo(() => {
    const map = new Map<string, { units: number; cost: number; events: number }>();
    costs.forEach((c) => {
      const cur = map.get(c.provider) ?? { units: 0, cost: 0, events: 0 };
      cur.units += Number(c.units_total ?? 0);
      cur.cost += Number(c.cost_usd_total ?? 0);
      cur.events += Number(c.event_count ?? 0);
      map.set(c.provider, cur);
    });
    return Array.from(map.entries())
      .map(([provider, v]) => ({ provider, ...v }))
      .sort((a, b) => b.cost - a.cost);
  }, [costs]);

  return (
    <div className="space-y-4">
      {/* ── PROVIDER HEALTH ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" /> Provider health (24h)
          </CardTitle>
          <CardDescription className="text-xs">
            Per-provider success rate + latency from <code>ai_call_log</code>. Watch for p95 spikes or dropping success rate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : providers.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No provider calls logged in the last 24h.
            </div>
          ) : (
            <div className="border rounded-md divide-y text-sm">
              <div className="grid grid-cols-6 gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold">
                <div>Provider</div>
                <div className="text-right">Calls</div>
                <div className="text-right">Success</div>
                <div className="text-right">p50</div>
                <div className="text-right">p95</div>
                <div className="text-right">Errors</div>
              </div>
              {providers.map((p) => {
                const rate = Number(p.success_rate_pct ?? 0);
                const tone = rate >= 90
                  ? "border-emerald-400 text-emerald-700"
                  : rate >= 70
                  ? "border-amber-400 text-amber-700"
                  : "border-rose-400 text-rose-700";
                return (
                  <div key={p.provider} className="grid grid-cols-6 gap-2 px-3 py-2 text-xs">
                    <div className="font-mono">{p.provider}</div>
                    <div className="text-right">{p.calls_24h.toLocaleString()}</div>
                    <div className="text-right">
                      <Badge variant="outline" className={tone}>{rate}%</Badge>
                    </div>
                    <div className="text-right text-muted-foreground">{p.p50_ms ?? "—"}ms</div>
                    <div className="text-right text-muted-foreground">{p.p95_ms ?? "—"}ms</div>
                    <div className="text-right">{p.errors_24h}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── BACKLOG & FRESHNESS ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Backlog & freshness
            </CardTitle>
            <CardDescription className="text-xs">
              Stuck queues + aging enrichment. Watchdog runs every 30 min and SMS Matt when thresholds breached (4 h cooldown).
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={pingWatchdog} disabled={pingingWatchdog}>
            {pingingWatchdog ? "Pinging…" : "Ping watchdog"}
          </Button>
        </CardHeader>
        <CardContent>
          {loading || !backlog ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(BACKLOG_THRESHOLDS) as Array<keyof BacklogRow>).map((k) => {
                const v = Number(backlog[k] ?? 0);
                const limit = BACKLOG_THRESHOLDS[k]!;
                const breached = v >= limit;
                return (
                  <div
                    key={k}
                    className={`rounded-lg border p-3 ${breached ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-slate-50"}`}
                  >
                    <div className="text-xs text-muted-foreground mb-0.5">
                      {k.replace(/_/g, " ")}
                    </div>
                    <div className={`text-xl font-bold ${breached ? "text-rose-700" : ""}`}>
                      {v.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      threshold ≥{limit}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── DEAD-ZONES SUMMARY ── */}
      {deadZones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-4 w-4" /> Dead-zone alerts ({deadZones.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Trade × city pairs that look broken: 0 sends despite prospects, 0 replies after 25+ sends, or &gt;20% bounce rate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {deadZones.slice(0, 30).map((d) => (
                <Badge key={`${d.trade}-${d.city}`} variant="outline" className="border-rose-400 text-rose-700 text-xs">
                  {d.trade} · {d.city}
                  {d.flag_no_sends && " · no sends"}
                  {d.flag_no_replies && " · no replies"}
                  {d.flag_high_bounce && ` · ${d.bounce_rate_pct}% bounce`}
                </Badge>
              ))}
              {deadZones.length > 30 && (
                <Badge variant="outline" className="text-xs">+{deadZones.length - 30} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TERRITORY DRILLDOWN ── */}
      <Card>
        <CardHeader className="flex flex-row items-end justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Map className="h-4 w-4" /> Territory funnel (30d)
            </CardTitle>
            <CardDescription className="text-xs">
              Per trade × city — find which territories convert and which silently leak.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="filter trade or city"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-7 h-8 w-48"
              />
            </div>
            <Button size="sm" variant="outline" onClick={exportTerritoryCsv}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : filteredTerritory.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No territory data.</div>
          ) : (
            <div className="border rounded-md divide-y text-xs max-h-96 overflow-y-auto">
              <div className="grid grid-cols-8 gap-2 px-3 py-2 bg-muted/50 font-semibold sticky top-0">
                <div>Trade</div>
                <div>City</div>
                <div className="text-right">Prosp.</div>
                <div className="text-right">Sent</div>
                <div className="text-right">Replied</div>
                <div className="text-right">Reply%</div>
                <div className="text-right">Bounce%</div>
                <div>Flags</div>
              </div>
              {filteredTerritory.slice(0, 200).map((r, i) => (
                <div key={`${r.trade}-${r.city}-${i}`} className="grid grid-cols-8 gap-2 px-3 py-1.5">
                  <div className="font-mono truncate">{r.trade}</div>
                  <div className="truncate">{r.city}</div>
                  <div className="text-right">{r.prospects}</div>
                  <div className="text-right">{r.sent}</div>
                  <div className="text-right">{r.replied}</div>
                  <div className="text-right">{r.reply_rate_pct ?? "—"}</div>
                  <div className="text-right">{r.bounce_rate_pct ?? "—"}</div>
                  <div className="flex gap-0.5">
                    {r.flag_no_sends && <Badge variant="outline" className="border-rose-400 text-rose-700 text-[9px] px-1 py-0">NS</Badge>}
                    {r.flag_no_replies && <Badge variant="outline" className="border-amber-400 text-amber-700 text-[9px] px-1 py-0">NR</Badge>}
                    {r.flag_high_bounce && <Badge variant="outline" className="border-rose-400 text-rose-700 text-[9px] px-1 py-0">HB</Badge>}
                  </div>
                </div>
              ))}
              {filteredTerritory.length > 200 && (
                <div className="px-3 py-2 text-center text-muted-foreground">
                  Showing 200 of {filteredTerritory.length}. Use CSV export for full data.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── COST & QUOTA ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Provider spend (14d)
          </CardTitle>
          <CardDescription className="text-xs">
            Aggregated from <code>provider_cost_ledger</code>. Edge functions log via <code>log_provider_cost()</code> RPC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : costsByProvider.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No cost data yet. Add <code>log_provider_cost()</code> calls in provider integrations to populate.
            </div>
          ) : (
            <div className="border rounded-md divide-y text-sm">
              <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold">
                <div>Provider</div>
                <div className="text-right">Events</div>
                <div className="text-right">Units</div>
                <div className="text-right">Cost (USD)</div>
              </div>
              {costsByProvider.map((c) => (
                <div key={c.provider} className="grid grid-cols-4 gap-2 px-3 py-2 text-xs">
                  <div className="font-mono">{c.provider}</div>
                  <div className="text-right">{c.events.toLocaleString()}</div>
                  <div className="text-right">{c.units.toLocaleString()}</div>
                  <div className="text-right font-semibold">${c.cost.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
