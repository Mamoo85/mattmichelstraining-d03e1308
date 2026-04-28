import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Play, Trash2, Mail, MessageSquare, AlertTriangle, CheckCircle2, Clock, Zap, Reply } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface QueueRow {
  id: string;
  channel: "email" | "sms";
  status: "queued" | "claimed" | "sent" | "failed" | "dead";
  attempts: number;
  scheduled_for: string;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
  payload: Record<string, unknown>;
  prospect_id: string | null;
}

interface ReplyRow {
  id: string;
  channel: "email" | "sms";
  from_address: string;
  subject: string | null;
  body: string;
  sentiment: string | null;
  handled: boolean;
  created_at: string;
  prospect_id: string | null;
}

interface Stats {
  queued: number;
  claimed: number;
  sent_24h: number;
  failed: number;
  dead: number;
  unhandled_replies: number;
}

export default function OutreachQueueMonitor() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<QueueRow[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [qRes, sRes24, fRes, dRes, jRes, rRes, urRes] = await Promise.all([
      supabase.from("outreach_send_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
      supabase.from("outreach_send_queue").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", since),
      supabase.from("outreach_send_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
      supabase.from("outreach_send_queue").select("id", { count: "exact", head: true }).eq("status", "dead"),
      supabase.from("outreach_send_queue").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("outreach_replies").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("outreach_replies").select("id", { count: "exact", head: true }).eq("handled", false),
    ]);

    setStats({
      queued: qRes.count ?? 0,
      claimed: 0,
      sent_24h: sRes24.count ?? 0,
      failed: fRes.count ?? 0,
      dead: dRes.count ?? 0,
      unhandled_replies: urRes.count ?? 0,
    });
    setJobs((jRes.data as QueueRow[]) ?? []);
    setReplies((rRes.data as ReplyRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh on queue changes
  useEffect(() => {
    const ch = supabase
      .channel("queue-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_send_queue" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_replies" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const runWorker = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-queue-worker", { body: { trigger: "manual" } });
      if (error) throw error;
      const s = (data as { stats?: Record<string, number> })?.stats;
      toast.success(`Worker ran: claimed ${s?.claimed ?? 0}, sent ${s?.sent ?? 0}, failed ${s?.failed ?? 0}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Worker failed");
    } finally {
      setRunning(false);
    }
  };

  const retryJob = async (id: string) => {
    const { error } = await supabase
      .from("outreach_send_queue")
      .update({ status: "queued", scheduled_for: new Date().toISOString(), attempts: 0, last_error: null })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Job re-queued"); load(); }
  };

  const deleteJob = async (id: string) => {
    const { error } = await supabase.from("outreach_send_queue").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Job deleted"); load(); }
  };

  const markReplyHandled = async (id: string) => {
    const { error } = await supabase
      .from("outreach_replies")
      .update({ handled: true, handled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Marked handled"); load(); }
  };

  const statusBadge = (s: QueueRow["status"]) => {
    const map: Record<string, string> = {
      queued: "bg-amber-100 text-amber-800 border-amber-300",
      claimed: "bg-blue-100 text-blue-800 border-blue-300",
      sent: "bg-emerald-100 text-emerald-800 border-emerald-300",
      failed: "bg-orange-100 text-orange-800 border-orange-300",
      dead: "bg-rose-100 text-rose-800 border-rose-300",
    };
    return <Badge variant="outline" className={map[s] || ""}>{s}</Badge>;
  };

  const sentimentBadge = (s: string | null) => {
    if (!s) return null;
    const map: Record<string, string> = {
      positive: "bg-emerald-100 text-emerald-800",
      negative: "bg-rose-100 text-rose-800",
      unsubscribe: "bg-rose-100 text-rose-800",
      auto_reply: "bg-slate-100 text-slate-700",
      neutral: "bg-blue-100 text-blue-800",
    };
    return <Badge variant="secondary" className={map[s] || ""}>{s}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Outreach Send Queue
          </h2>
          <p className="text-sm text-muted-foreground">Background sender with retry, bounce tracking, and reply detection</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={runWorker} disabled={running}>
            <Play className="h-4 w-4 mr-1" /> {running ? "Running…" : "Run worker now"}
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {loading && !stats ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : stats && (
          <>
            <StatCard icon={<Clock className="h-4 w-4" />} label="Queued" value={stats.queued} tone="amber" />
            <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Sent (24h)" value={stats.sent_24h} tone="emerald" />
            <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Failed" value={stats.failed} tone="orange" />
            <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Dead-letter" value={stats.dead} tone="rose" />
            <StatCard icon={<Reply className="h-4 w-4" />} label="Unhandled replies" value={stats.unhandled_replies} tone="blue" />
            <StatCard icon={<Zap className="h-4 w-4" />} label="Worker" value="Every 1 min" tone="slate" small />
          </>
        )}
      </div>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList>
          <TabsTrigger value="queue">Queue ({jobs.length})</TabsTrigger>
          <TabsTrigger value="replies">
            Replies ({replies.length}){stats?.unhandled_replies ? <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] px-1.5 min-w-[18px] h-4">{stats.unhandled_replies}</span> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent jobs</CardTitle>
              <CardDescription className="text-xs">Last 50 — live updates via Realtime</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {jobs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Queue is empty</div>}
                {jobs.map(j => (
                  <div key={j.id} className="p-3 hover:bg-muted/40 text-sm flex items-start gap-3">
                    <div className="mt-0.5">
                      {j.channel === "email" ? <Mail className="h-4 w-4 text-muted-foreground" /> : <MessageSquare className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(j.status)}
                        <span className="text-xs text-muted-foreground">{(j.payload as { to?: string }).to || "—"}</span>
                        {j.attempts > 0 && <Badge variant="outline" className="text-[10px]">attempt {j.attempts}</Badge>}
                      </div>
                      <div className="text-xs mt-1 truncate text-foreground/80">
                        {(j.payload as { subject?: string; body?: string }).subject || (j.payload as { body?: string }).body?.slice(0, 80) || "—"}
                      </div>
                      {j.last_error && (
                        <div className="text-xs mt-1 text-rose-700 truncate" title={j.last_error}>⚠ {j.last_error}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {j.sent_at ? `sent ${formatDistanceToNow(new Date(j.sent_at))} ago` :
                          j.status === "queued" ? `runs ${formatDistanceToNow(new Date(j.scheduled_for), { addSuffix: true })}` :
                          `created ${formatDistanceToNow(new Date(j.created_at))} ago`}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {(j.status === "failed" || j.status === "dead") && (
                        <Button size="sm" variant="outline" onClick={() => retryJob(j.id)}>Retry</Button>
                      )}
                      {j.status !== "sent" && (
                        <Button size="sm" variant="ghost" onClick={() => deleteJob(j.id)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replies">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inbound replies</CardTitle>
              <CardDescription className="text-xs">Auto-classified by sentiment. Unsubscribes auto-suppress.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {replies.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No replies yet</div>}
                {replies.map(r => (
                  <div key={r.id} className={`p-3 text-sm ${!r.handled ? "bg-amber-50/60" : ""}`}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {r.channel === "email" ? <Mail className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                      <span className="font-medium text-xs">{r.from_address}</span>
                      {sentimentBadge(r.sentiment)}
                      {!r.handled && <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">needs review</Badge>}
                      <span className="text-[10px] text-muted-foreground ml-auto">{formatDistanceToNow(new Date(r.created_at))} ago</span>
                    </div>
                    {r.subject && <div className="text-xs font-medium mb-0.5">{r.subject}</div>}
                    <div className="text-xs text-foreground/80 line-clamp-3">{r.body}</div>
                    {!r.handled && (
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => markReplyHandled(r.id)}>
                        Mark handled
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value, tone, small }: { icon: React.ReactNode; label: string; value: number | string; tone: string; small?: boolean }) {
  const toneMap: Record<string, string> = {
    amber: "border-amber-300 bg-amber-50",
    emerald: "border-emerald-300 bg-emerald-50",
    orange: "border-orange-300 bg-orange-50",
    rose: "border-rose-300 bg-rose-50",
    blue: "border-blue-300 bg-blue-50",
    slate: "border-slate-300 bg-slate-50",
  };
  return (
    <div className={`rounded-lg border p-3 ${toneMap[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`font-bold ${small ? "text-sm" : "text-2xl"}`}>{value}</div>
    </div>
  );
}
