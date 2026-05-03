import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const FLOOR = 150;
const COLD_TEMPLATES = [
  "cold_outreach",
  "multi_service_pitch_1", "multi_service_pitch_2", "multi_service_pitch_3",
  "web_drip_d1", "web_drip_d4", "web_drip_d8", "web_drip_d15",
  "techalert_cold_outreach", "techalert_followup_d3", "techalert_followup_d7", "techalert_followup_d14",
  "contractor_drip_d0", "contractor_drip_d3", "contractor_drip_d7", "contractor_drip_d14",
  "dossier_cold_outreach",
];

const SENDERS: { fn: string; label: string; product: string; trial: string }[] = [
  { fn: "contractor-prospector", label: "Contractor Prospector", product: "Contractor Leads", trial: "7d + 50% off" },
  { fn: "techalert-outreach", label: "TechAlert Outreach", product: "TechAlert (Hiring)", trial: "30d" },
  { fn: "techalert-followup-drip", label: "TechAlert Drip (D3/D7/D14)", product: "TechAlert (Hiring)", trial: "30d" },
  { fn: "multi-service-drip", label: "Multi-Service Drip", product: "Bundle", trial: "7d + 50% off" },
  { fn: "web-design-drip", label: "Web Design Drip", product: "Web Design", trial: "7d + 50% off" },
  { fn: "prospect-local-businesses", label: "Local Business Prospector", product: "Local Bundle", trial: "7d + 50% off" },
];

interface DayBucket { date: string; count: number }
interface TplBucket { template: string; count: number }

export default function AdminColdEmailAudit() {
  const [days, setDays] = useState<DayBucket[]>([]);
  const [today, setToday] = useState<TplBucket[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data, error } = await supabase
      .from("email_send_log")
      .select("message_id, template_name, status, created_at")
      .in("template_name", COLD_TEMPLATES)
      .eq("status", "sent")
      .gte("created_at", since)
      .limit(10000);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    // dedupe by message_id
    const seen = new Set<string>();
    const dedup = (data || []).filter((r: any) => {
      if (!r.message_id || seen.has(r.message_id)) return false;
      seen.add(r.message_id);
      return true;
    });

    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      byDay.set(d, 0);
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const tplToday = new Map<string, number>();
    for (const r of dedup) {
      const d = (r.created_at as string).slice(0, 10);
      byDay.set(d, (byDay.get(d) || 0) + 1);
      if (d === todayStr) tplToday.set(r.template_name, (tplToday.get(r.template_name) || 0) + 1);
    }
    setDays([...byDay.entries()].map(([date, count]) => ({ date, count })));
    setToday([...tplToday.entries()].map(([template, count]) => ({ template, count })).sort((a, b) => b.count - a.count));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runFn = async (fn: string) => {
    setBusy(fn);
    const { data, error } = await supabase.functions.invoke(fn, { body: { backfill: true } });
    setBusy(null);
    if (error) toast.error(`${fn}: ${error.message}`);
    else toast.success(`${fn} triggered: ${JSON.stringify(data).slice(0, 120)}`);
    setTimeout(load, 3000);
  };

  const runSentinel = async () => {
    setBusy("sentinel");
    const { data, error } = await supabase.functions.invoke("cold-email-volume-sentinel", { body: { force: true } });
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(`Sentinel: sent ${(data as any)?.count}/${FLOOR}, shortfall ${(data as any)?.shortfall}`);
    setTimeout(load, 5000);
  };

  const todayCount = days[days.length - 1]?.count || 0;
  const max = Math.max(FLOOR, ...days.map((d) => d.count));

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Cold Email Audit</h1>
        <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Today</div>
          <div className={`text-3xl font-bold ${todayCount >= FLOOR ? "text-green-500" : "text-destructive"}`}>{todayCount}</div>
          <div className="text-xs">/ {FLOOR} floor</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">14-day total</div>
          <div className="text-3xl font-bold">{days.reduce((a, d) => a + d.count, 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">14-day avg</div>
          <div className="text-3xl font-bold">{Math.round(days.reduce((a, d) => a + d.count, 0) / 14)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Days under floor</div>
          <div className="text-3xl font-bold text-destructive">{days.filter((d) => d.count < FLOOR).length}</div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-4">14-Day Volume vs 150 Floor</h2>
        <div className="flex items-end gap-2 h-48">
          {days.map((d) => {
            const pct = (d.count / max) * 100;
            const under = d.count < FLOOR;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px]">{d.count}</div>
                <div
                  className={`w-full rounded-t ${under ? "bg-destructive" : "bg-primary"}`}
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
                <div className="text-[10px] text-muted-foreground">{d.date.slice(5)}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Red bars = under 150/day floor</div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-4">Today by Template</h2>
        {today.length === 0 && <div className="text-sm text-muted-foreground">No cold emails sent today yet.</div>}
        <div className="space-y-1">
          {today.map((t) => (
            <div key={t.template} className="flex justify-between text-sm border-b py-1">
              <span className="font-mono text-xs">{t.template}</span>
              <span className="font-bold">{t.count}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Senders & Trial Verification</h2>
          <Button onClick={runSentinel} disabled={busy === "sentinel"}>
            {busy === "sentinel" ? "Running..." : `Force 150 Top-Off`}
          </Button>
        </div>
        <div className="space-y-2">
          {SENDERS.map((s) => (
            <div key={s.fn} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground font-mono">{s.fn}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={s.trial.includes("30") ? "secondary" : "default"}>{s.trial}</Badge>
                <Button size="sm" onClick={() => runFn(s.fn)} disabled={busy === s.fn}>
                  {busy === s.fn ? "..." : "Run Now"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Offer Standardization (Locked)</h2>
        <ul className="text-sm space-y-1 list-disc pl-5">
          <li>Hiring radars (TechAlert / CareAlert / Talent / Hire) → <strong>30-day</strong> trial, no CC</li>
          <li>All other monthly products → <strong>7-day</strong> trial, no CC, <strong>+ 50% off first 3 months</strong></li>
          <li>Enforced in <code>_shared/dwa-email.ts</code> &rarr; <code>trialCtaHtml()</code></li>
        </ul>
      </Card>
    </div>
  );
}
