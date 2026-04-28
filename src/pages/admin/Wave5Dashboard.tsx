import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CronStatusWidget from "@/components/admin/CronStatusWidget";
import AlertLogSearchPanel from "@/components/admin/AlertLogSearchPanel";
import AlertRuleTesterPanel from "@/components/admin/AlertRuleTesterPanel";
import RerunEnrichmentDialog from "@/components/admin/RerunEnrichmentDialog";
import { DollarSign, Gauge, Hourglass, BarChart3 } from "lucide-react";

interface SpendRow { day: string; provider: string; spend_usd: number; }
interface DlqRow { created_at: string; }
interface ProspectConfidence { enrichment_confidence: number | null; }

export default function Wave5Dashboard() {
  const [spend, setSpend] = useState<SpendRow[]>([]);
  const [dailyBudget, setDailyBudget] = useState(50);
  const [dlq, setDlq] = useState<DlqRow[]>([]);
  const [confidences, setConfidences] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [s, b, d, c] = await Promise.all([
        supabase
          .from("enrichment_provider_spend_daily" as any)
          .select("day, provider, spend_usd")
          .gte("day", since.slice(0, 10))
          .order("day", { ascending: true }),
        supabase
          .from("enrichment_walker_config")
          .select("value_numeric")
          .eq("key", "daily_budget_usd")
          .maybeSingle(),
        supabase
          .from("enrichment_dead_letter")
          .select("created_at")
          .eq("permanent_failure", false),
        supabase
          .from("prospects" as any)
          .select("enrichment_confidence")
          .not("enrichment_confidence", "is", null)
          .limit(1000),
      ]);
      setSpend((s.data as any[]) || []);
      setDailyBudget(Number((b.data as any)?.value_numeric ?? 50));
      setDlq((d.data as any[]) || []);
      setConfidences(((c.data as any[]) || []).map((x) => Number(x.enrichment_confidence)).filter((v) => !isNaN(v)));
      setLoading(false);
    })();
  }, []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todaySpend = useMemo(
    () => spend.filter((r) => r.day === today).reduce((s, r) => s + Number(r.spend_usd || 0), 0),
    [spend, today],
  );
  const spendByDay = useMemo(() => {
    const m = new Map<string, number>();
    spend.forEach((r) => m.set(r.day, (m.get(r.day) || 0) + Number(r.spend_usd || 0)));
    return Array.from(m.entries()).sort();
  }, [spend]);

  const dlqBuckets = useMemo(() => {
    const now = Date.now();
    const buckets = { "<1d": 0, "1–3d": 0, "3–7d": 0, ">7d": 0 };
    dlq.forEach((r) => {
      const days = (now - new Date(r.created_at).getTime()) / 86400_000;
      if (days < 1) buckets["<1d"]++;
      else if (days < 3) buckets["1–3d"]++;
      else if (days < 7) buckets["3–7d"]++;
      else buckets[">7d"]++;
    });
    return buckets;
  }, [dlq]);

  const histogram = useMemo(() => {
    const buckets = Array(10).fill(0) as number[];
    confidences.forEach((c) => {
      const i = Math.min(9, Math.floor(c / 10));
      buckets[i]++;
    });
    const sorted = [...confidences].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const p25 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
    const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
    return { buckets, med, p25, p75, total: sorted.length };
  }, [confidences]);

  const budgetPct = Math.min(100, (todaySpend / Math.max(1, dailyBudget)) * 100);
  const walkerPaused = todaySpend >= dailyBudget;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Wave 5 Dashboard</h1>
        <p className="text-sm text-muted-foreground">Walker spend, DLQ aging, confidence distribution, alerts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="w-4 h-4" /> Today's spend
          </div>
          <div className="text-2xl font-bold mt-1">${todaySpend.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">Budget: ${dailyBudget.toFixed(2)}</div>
          <div className="h-2 bg-muted mt-2 rounded overflow-hidden">
            <div
              className={`h-full ${walkerPaused ? "bg-rose-500" : budgetPct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <div className={`text-xs mt-2 font-semibold ${walkerPaused ? "text-rose-400" : "text-emerald-400"}`}>
            Walker {walkerPaused ? "PAUSED" : "ACTIVE"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hourglass className="w-4 h-4" /> DLQ aging
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2 text-center">
            {Object.entries(dlqBuckets).map(([k, v]) => (
              <div key={k} className={`p-2 rounded ${k === ">7d" && v > 0 ? "bg-rose-500/20" : "bg-muted/40"}`}>
                <div className="text-lg font-bold">{v}</div>
                <div className="text-[10px] text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="w-4 h-4" /> Confidence
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            n={histogram.total} · p25={histogram.p25} · med={histogram.med} · p75={histogram.p75}
          </div>
          <div className="flex items-end gap-0.5 h-16 mt-2">
            {histogram.buckets.map((v, i) => {
              const max = Math.max(1, ...histogram.buckets);
              return (
                <div
                  key={i}
                  className="flex-1 bg-primary/70 rounded-t"
                  style={{ height: `${(v / max) * 100}%` }}
                  title={`${i * 10}-${i * 10 + 9}: ${v}`}
                />
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Gauge className="w-4 h-4" /> Spend (last 7 days)
        </div>
        <div className="flex items-end gap-1 h-32">
          {spendByDay.map(([day, val]) => {
            const max = Math.max(dailyBudget, ...spendByDay.map(([, v]) => v));
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t ${val >= dailyBudget ? "bg-rose-500" : "bg-primary"}`}
                  style={{ height: `${(val / max) * 100}%` }}
                  title={`${day}: $${val.toFixed(2)}`}
                />
                <div className="text-[10px] text-muted-foreground">{day.slice(5)}</div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-muted-foreground mt-2">Red bars = at/over daily budget cap (${dailyBudget.toFixed(2)})</div>
      </Card>

      <Tabs defaultValue="crons">
        <TabsList>
          <TabsTrigger value="crons">Crons</TabsTrigger>
          <TabsTrigger value="alerts">Alert log</TabsTrigger>
          <TabsTrigger value="tester">Rule tester</TabsTrigger>
          <TabsTrigger value="rerun">Re-run</TabsTrigger>
        </TabsList>
        <TabsContent value="crons" className="mt-4">
          <CronStatusWidget />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <AlertLogSearchPanel />
        </TabsContent>
        <TabsContent value="tester" className="mt-4">
          <AlertRuleTesterPanel />
        </TabsContent>
        <TabsContent value="rerun" className="mt-4">
          <RerunEnrichmentDialog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
