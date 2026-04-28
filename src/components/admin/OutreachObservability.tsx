import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, RefreshCw, TrendingUp, Mail, MessageSquare, Target, AlertTriangle, MapPin, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";

interface FunnelRow {
  prospects_30d: number;
  sent_30d: number;
  opened_30d: number;
  clicked_30d: number;
  replied_30d: number;
  bounced_30d: number;
  unsubscribed_30d: number;
  blocked_30d: number;
}

interface HourlyRow {
  hour: string;
  channel: "email" | "sms";
  sent_count: number;
  failed_count: number;
}

interface StageRow {
  stage: string;
  attempts: number;
  hits: number;
  misses: number;
  avg_confidence: number | null;
  hit_rate_pct: number | null;
}

export default function OutreachObservability() {
  const [funnel, setFunnel] = useState<FunnelRow | null>(null);
  const [hourly, setHourly] = useState<HourlyRow[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statewideBacklog, setStatewideBacklog] = useState<number | null>(null);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [enrichRunning, setEnrichRunning] = useState(false);

  const loadBacklog = useCallback(async () => {
    const { count } = await supabase
      .from("contractor_outreach_prospects")
      .select("id", { count: "exact", head: true })
      .eq("source", "google_maps_statewide")
      .is("email", null)
      .is("unsubscribed_at", null);
    setStatewideBacklog(count ?? 0);
  }, []);

  const runSweep = async () => {
    setSweepRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("contractor-outreach-statewide-sweep", {
        body: { tiers: ["primary", "secondary"], max_seconds: 90, limit_per_query: 20 },
      });
      if (error) throw error;
      toast.success(`Sweep done: scanned ${data?.scanned ?? 0}, added ${data?.inserted ?? 0}, skipped ${data?.skipped_duplicates ?? 0}`);
      await loadBacklog();
    } catch (e: any) {
      toast.error(`Sweep failed: ${e.message}`);
    } finally {
      setSweepRunning(false);
    }
  };

  const runEnrich = async () => {
    setEnrichRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("contractor-outreach-statewide-enrich", {
        body: { max_seconds: 90, batch_size: 5, limit: 60 },
      });
      if (error) throw error;
      toast.success(`Enriched ${data?.enriched ?? 0}/${data?.attempted ?? 0} (backlog pulled: ${data?.backlog_pulled ?? 0})`);
      await loadBacklog();
    } catch (e: any) {
      toast.error(`Enrich failed: ${e.message}`);
    } finally {
      setEnrichRunning(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [fRes, hRes, sRes] = await Promise.all([
      supabase.from("outreach_funnel_summary" as any).select("*").maybeSingle(),
      supabase.from("outreach_send_metrics_hourly" as any).select("*").order("hour", { ascending: true }),
      supabase.from("outreach_waterfall_stage_stats" as any).select("*"),
    ]);
    setFunnel((fRes.data as unknown as FunnelRow) ?? null);
    setHourly((hRes.data as unknown as HourlyRow[]) ?? []);
    setStages((sRes.data as unknown as StageRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); loadBacklog(); }, [load, loadBacklog]);

  // Combine email + sms hourly into one series
  const chartData = (() => {
    const map = new Map<string, { hour: string; email_sent: number; sms_sent: number; failed: number }>();
    hourly.forEach((row) => {
      const key = new Date(row.hour).toLocaleString([], { month: "short", day: "numeric", hour: "numeric" });
      const cur = map.get(key) ?? { hour: key, email_sent: 0, sms_sent: 0, failed: 0 };
      if (row.channel === "email") cur.email_sent += row.sent_count;
      if (row.channel === "sms") cur.sms_sent += row.sent_count;
      cur.failed += row.failed_count;
      map.set(key, cur);
    });
    return Array.from(map.values());
  })();

  const replyRate = funnel && funnel.sent_30d > 0 ? ((funnel.replied_30d / funnel.sent_30d) * 100).toFixed(1) : "0";
  const bounceRate = funnel && funnel.sent_30d > 0 ? ((funnel.bounced_30d / funnel.sent_30d) * 100).toFixed(1) : "0";
  const openRate = funnel && funnel.sent_30d > 0 ? ((funnel.opened_30d / funnel.sent_30d) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Outreach Observability
          </h2>
          <p className="text-sm text-muted-foreground">
            Last 30 days · funnel, send velocity, and enrichment-waterfall hit rates
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Funnel cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {loading && !funnel ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : funnel && (
          <>
            <FunnelCard label="Prospects" value={funnel.prospects_30d} tone="slate" />
            <FunnelCard label="Sent" value={funnel.sent_30d} tone="blue" />
            <FunnelCard label="Opened" value={funnel.opened_30d} subtitle={`${openRate}%`} tone="emerald" />
            <FunnelCard label="Clicked" value={funnel.clicked_30d} tone="emerald" />
            <FunnelCard label="Replied" value={funnel.replied_30d} subtitle={`${replyRate}%`} tone="emerald" />
            <FunnelCard label="Bounced" value={funnel.bounced_30d} subtitle={`${bounceRate}%`} tone={Number(bounceRate) > 5 ? "rose" : "amber"} />
            <FunnelCard label="Unsub'd" value={funnel.unsubscribed_30d} tone="rose" />
            <FunnelCard label="Blocked" value={funnel.blocked_30d} tone="amber" />
          </>
        )}
      </div>

      {/* Send velocity chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Send velocity (last 7 days)
          </CardTitle>
          <CardDescription className="text-xs">Hourly sent counts by channel + failures</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              No sends in the last 7 days
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="email_sent" stroke="hsl(var(--primary))" name="Email" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sms_sent" stroke="hsl(220 70% 50%)" name="SMS" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="failed" stroke="hsl(0 70% 50%)" name="Failed" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Waterfall stage performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Enrichment waterfall hit rates
          </CardTitle>
          <CardDescription className="text-xs">
            Which stages are paying off (last 30 days). Low hit-rate stages cost API calls without results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : stages.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No enrichment traces recorded yet. Run an enrichment to populate.
            </div>
          ) : (
            <>
              <div className="h-56 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stages} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="hits" fill="hsl(142 70% 45%)" name="Hits" />
                    <Bar dataKey="misses" fill="hsl(0 60% 60%)" name="Misses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="border rounded-md divide-y text-sm">
                <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold">
                  <div>Stage</div>
                  <div className="text-right">Attempts</div>
                  <div className="text-right">Hits</div>
                  <div className="text-right">Hit rate</div>
                  <div className="text-right">Avg confidence</div>
                </div>
                {stages.map((s) => (
                  <div key={s.stage} className="grid grid-cols-5 gap-2 px-3 py-2 text-xs">
                    <div className="font-mono">{s.stage}</div>
                    <div className="text-right">{s.attempts}</div>
                    <div className="text-right">{s.hits}</div>
                    <div className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          (s.hit_rate_pct ?? 0) >= 50
                            ? "border-emerald-400 text-emerald-700"
                            : (s.hit_rate_pct ?? 0) >= 20
                              ? "border-amber-400 text-amber-700"
                              : "border-rose-400 text-rose-700"
                        }
                      >
                        {s.hit_rate_pct ?? 0}%
                      </Badge>
                    </div>
                    <div className="text-right text-muted-foreground">{s.avg_confidence ?? "—"}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Health hints */}
      {funnel && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Deliverability signals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <SignalRow
              icon={<Mail className="h-4 w-4" />}
              label="Bounce rate"
              value={`${bounceRate}%`}
              healthy={Number(bounceRate) < 3}
              warning={Number(bounceRate) >= 3 && Number(bounceRate) < 5}
              hint="Industry safe: <3%. Above 5% risks IP reputation."
            />
            <SignalRow
              icon={<MessageSquare className="h-4 w-4" />}
              label="Reply rate"
              value={`${replyRate}%`}
              healthy={Number(replyRate) >= 1}
              warning={Number(replyRate) < 1 && funnel.sent_30d > 50}
              hint="Cold B2B benchmark: 1–3%. Below 1% = template needs work."
            />
            <SignalRow
              icon={<Target className="h-4 w-4" />}
              label="Open rate"
              value={`${openRate}%`}
              healthy={Number(openRate) >= 20}
              warning={Number(openRate) < 20 && funnel.sent_30d > 50}
              hint="Healthy: 20–40%. Below 20% = subject line + sender reputation issue."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FunnelCard({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: number;
  subtitle?: string;
  tone: "slate" | "blue" | "emerald" | "amber" | "rose";
}) {
  const toneMap: Record<string, string> = {
    slate: "border-slate-300 bg-slate-50",
    blue: "border-blue-300 bg-blue-50",
    emerald: "border-emerald-300 bg-emerald-50",
    amber: "border-amber-300 bg-amber-50",
    rose: "border-rose-300 bg-rose-50",
  };
  return (
    <div className={`rounded-lg border p-3 ${toneMap[tone]}`}>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-xl font-bold">{value.toLocaleString()}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
    </div>
  );
}

function SignalRow({
  icon,
  label,
  value,
  healthy,
  warning,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  healthy: boolean;
  warning: boolean;
  hint: string;
}) {
  const tone = healthy ? "emerald" : warning ? "amber" : "rose";
  const toneMap: Record<string, string> = {
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-300",
    amber: "text-amber-700 bg-amber-50 border-amber-300",
    rose: "text-rose-700 bg-rose-50 border-rose-300",
  };
  return (
    <div className="flex items-center gap-3 p-2 rounded border bg-card">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Badge variant="outline" className={toneMap[tone]}>{value}</Badge>
    </div>
  );
}
