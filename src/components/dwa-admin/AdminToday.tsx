import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, AlertTriangle, MessageSquare, Activity, Flame } from "lucide-react";

type Stats = {
  revenueToday: number;
  signupsToday: number;
  failingCrons: number;
  hotReplies: number;
  repliesToday: number;
  emailsSentToday: number;
};

type HotReply = {
  id: string;
  company_name: string | null;
  contact_email: string | null;
  reply_body: string | null;
  updated_at: string;
};

type CronRow = {
  jobname: string;
  last_run: string | null;
  status: "green" | "red" | "stale";
};

export default function AdminToday() {
  const [stats, setStats] = useState<Stats>({
    revenueToday: 0, signupsToday: 0, failingCrons: 0,
    hotReplies: 0, repliesToday: 0, emailsSentToday: 0,
  });
  const [hotReplies, setHotReplies] = useState<HotReply[]>([]);
  const [crons, setCrons] = useState<CronRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(), 60_000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const results = await Promise.allSettled([
      supabase.from("stripe_payment_events" as any).select("amount_cents", { count: "exact" })
        .gte("created_at", todayISO),
      supabase.from("trial_signups" as any).select("id", { count: "exact", head: true })
        .gte("created_at", todayISO),
      supabase.from("techalert_prospect_targets" as any)
        .select("id, company_name, contact_email, reply_body, updated_at")
        .eq("reply_positive", true)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase.from("techalert_prospect_targets" as any).select("id", { count: "exact", head: true })
        .not("replied_at", "is", null)
        .gte("replied_at", todayISO),
      supabase.from("email_send_log" as any).select("id", { count: "exact", head: true })
        .gte("created_at", todayISO),
    ]);

    let revenueToday = 0;
    if (results[0].status === "fulfilled" && results[0].value.data) {
      revenueToday = (results[0].value.data as any[]).reduce(
        (sum, r) => sum + (r.amount_cents || 0), 0
      ) / 100;
    }

    const signupsToday = results[1].status === "fulfilled" ? (results[1].value.count || 0) : 0;
    const repliesData = results[2].status === "fulfilled" ? ((results[2].value.data as any) || []) : [];
    const repliesToday = results[3].status === "fulfilled" ? (results[3].value.count || 0) : 0;
    const emailsSentToday = results[4].status === "fulfilled" ? (results[4].value.count || 0) : 0;

    setHotReplies(repliesData);
    setStats({
      revenueToday,
      signupsToday,
      failingCrons: 0,
      hotReplies: repliesData.length,
      repliesToday,
      emailsSentToday,
    });

    // Cron health
    try {
      const { data: cronData } = await supabase.functions.invoke("scanner-health-matrix", { body: {} });
      if (cronData?.crons) {
        setCrons(cronData.crons.slice(0, 20));
        setStats((s) => ({ ...s, failingCrons: cronData.crons.filter((c: CronRow) => c.status !== "green").length }));
      }
    } catch { /* ignore */ }

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">🏠 Today</h1>
        <p className="text-white/50 text-sm">Live snapshot · refreshes every 60s</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Revenue today" value={`$${stats.revenueToday.toFixed(0)}`} accent="text-emerald-400" />
        <KpiCard icon={<Users className="w-4 h-4" />} label="Signups today" value={stats.signupsToday.toString()} accent="text-[#00d4ff]" />
        <KpiCard icon={<Flame className="w-4 h-4" />} label="Hot replies" value={stats.hotReplies.toString()} accent="text-orange-400" />
        <KpiCard icon={<MessageSquare className="w-4 h-4" />} label="Replies today" value={stats.repliesToday.toString()} accent="text-white" />
        <KpiCard icon={<Activity className="w-4 h-4" />} label="Emails sent" value={stats.emailsSentToday.toString()} accent="text-white" />
        <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Failing crons" value={stats.failingCrons.toString()} accent={stats.failingCrons > 0 ? "text-red-400" : "text-emerald-400"} />
      </div>

      <Card className="bg-[#0f1f33] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" /> Hot Replies (call these now)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-white/50 text-sm">Loading…</div> :
            hotReplies.length === 0 ? <div className="text-white/50 text-sm">No hot replies yet. Get back to outreach.</div> :
            <div className="divide-y divide-white/5">
              {hotReplies.map((r) => (
                <div key={r.id} className="py-3 flex justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium truncate">{r.company_name || r.contact_email || "Unknown"}</div>
                    <div className="text-white/60 text-xs truncate">{r.contact_email}</div>
                    {r.reply_body && <div className="text-white/40 text-xs mt-1 line-clamp-2">"{r.reply_body}"</div>}
                  </div>
                  <div className="text-white/40 text-xs whitespace-nowrap">{new Date(r.updated_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>

      {crons.length > 0 && (
        <Card className="bg-[#0f1f33] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">Cron health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs">
              {crons.map((c) => (
                <div key={c.jobname} className="flex justify-between py-1.5 px-2 rounded hover:bg-white/5">
                  <span className="text-white/70 truncate">{c.jobname}</span>
                  <span className={c.status === "green" ? "text-emerald-400" : "text-red-400"}>
                    {c.status === "green" ? "✓" : "✗"} {c.last_run ? new Date(c.last_run).toLocaleTimeString() : "never"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0f1f33] border border-white/10 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase tracking-wider mb-1">
        {icon} {label}
      </div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}
