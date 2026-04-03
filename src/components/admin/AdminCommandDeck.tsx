import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, RefreshCw, Send, Mail, Users, DollarSign, Loader2,
  CheckCircle2, AlertTriangle, Activity, BarChart3, Clock,
  Play, Shield, Download, MessageSquare, Pause, Globe, Star,
  TrendingUp, Megaphone, Database, Wrench, Bot, ChevronRight,
  Cpu, XCircle, UserPlus, RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────
type ActionState = "idle" | "running" | "done" | "error";

interface QuickAction {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  category: string;
  fn: () => Promise<string>;
}

// ─── Individual Action Button ──────────────────────────────────────────────────
function ActionButton({ action }: { action: QuickAction }) {
  const [state, setState] = useState<ActionState>("idle");
  const [result, setResult] = useState<string>("");
  const { toast } = useToast();
  const Icon = action.icon;

  const run = async () => {
    setState("running");
    setResult("");
    try {
      const msg = await action.fn();
      setState("done");
      setResult(msg);
      toast({ title: action.label, description: msg });
      setTimeout(() => setState("idle"), 6000);
    } catch (e: any) {
      setState("error");
      setResult(e?.message ?? "Error");
      toast({ title: action.label, description: e?.message ?? "Error", variant: "destructive" });
      setTimeout(() => setState("idle"), 6000);
    }
  };

  return (
    <button
      onClick={run}
      disabled={state === "running"}
      className={`group relative flex flex-col gap-2 p-4 rounded-lg border text-left transition-all w-full
        ${state === "done" ? "border-green-500/60 bg-green-500/10" :
          state === "error" ? "border-red-500/60 bg-red-500/10" :
          "border-border bg-card hover:border-primary/40 hover:bg-card/80 active:scale-95"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${action.color}`}>
          {state === "running" ? <Loader2 size={14} className="animate-spin" /> :
           state === "done" ? <CheckCircle2 size={14} /> :
           state === "error" ? <AlertTriangle size={14} /> :
           <Icon size={14} />}
        </div>
        {state === "idle" && <ChevronRight size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground mt-1 flex-shrink-0" />}
      </div>
      <div>
        <div className="text-xs font-bold text-foreground leading-tight">{action.label}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
          {result || action.desc}
        </div>
      </div>
    </button>
  );
}

// ─── Stats Cards ───────────────────────────────────────────────────────────────
function SystemHealth() {
  const { data: counts } = useQuery({
    queryKey: ["command-deck-counts"],
    queryFn: async () => {
      const [aiQueue, support, drafts, transactions] = await Promise.all([
        supabase.from("ai_action_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("coach_ai_drafts").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("transactions").select("amount").eq("status", "completed").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);
      const revenue = (transactions.data ?? []).reduce((s: number, t: any) => s + (t.amount ?? 0), 0);
      return {
        aiQueue: aiQueue.count ?? 0,
        support: support.count ?? 0,
        drafts: drafts.count ?? 0,
        revenue30d: revenue,
      };
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const stats = [
    { label: "30d Revenue", value: `$${((counts?.revenue30d ?? 0) / 100).toLocaleString()}`, icon: DollarSign, color: "text-green-400" },
    { label: "AI Queue", value: counts?.aiQueue ?? 0, icon: Bot, color: counts?.aiQueue ? "text-orange-400" : "text-muted-foreground" },
    { label: "Support", value: counts?.support ?? 0, icon: MessageSquare, color: counts?.support ? "text-red-400" : "text-muted-foreground" },
    { label: "Coach Drafts", value: counts?.drafts ?? 0, icon: Users, color: counts?.drafts ? "text-yellow-400" : "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <Icon size={18} className={s.color} />
            <div>
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── AI Model Selector ─────────────────────────────────────────────────────────
const AI_MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", desc: "Fast · Cost-efficient · Daily tasks", badge: "DEFAULT" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", desc: "Balanced · Better quality · Complex tasks", badge: "SMART" },
  { id: "claude-opus-4-6", label: "Opus 4.6", desc: "Best quality · Slow · Use sparingly", badge: "BEST" },
];

const AI_TASK_TYPES = [
  { key: "content_generation", label: "Content Generation" },
  { key: "workout_generation", label: "Workout Generation" },
  { key: "newsletter", label: "Newsletter" },
  { key: "support_triage", label: "Support Triage" },
  { key: "coach_replies", label: "Coach Replies" },
  { key: "outreach", label: "Outreach / Prospecting" },
  { key: "reports", label: "Reports & Analytics" },
];

function AIModelSelector() {
  const getModel = (taskKey: string) =>
    localStorage.getItem(`ai-model-${taskKey}`) ?? "claude-haiku-4-5-20251001";
  const setModel = (taskKey: string, modelId: string) =>
    localStorage.setItem(`ai-model-${taskKey}`, modelId);
  const [, forceUpdate] = useState(0);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cpu size={14} className="text-primary" />
          AI Model Selector
          <Badge variant="outline" className="text-[9px] ml-auto">Saved to Browser</Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">Choose which Claude model handles each task type. Haiku is cheapest and fastest.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AI_TASK_TYPES.map((task) => (
            <div key={task.key} className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground w-32 flex-shrink-0">{task.label}</Label>
              <Select
                value={getModel(task.key)}
                onValueChange={(v) => { setModel(task.key, v); forceUpdate(n => n + 1); }}
              >
                <SelectTrigger className="h-7 text-[11px] flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-[11px]">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground ml-1">— {m.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mass Trial Extension ──────────────────────────────────────────────────────
function MassTrialExtension() {
  const [days, setDays] = useState("7");
  const [state, setState] = useState<ActionState>("idle");
  const { toast } = useToast();

  const run = async () => {
    if (!days || isNaN(Number(days))) return;
    setState("running");
    try {
      const cutoff = new Date();
      const newDate = new Date(cutoff.getTime() + Number(days) * 86400000).toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .update({ trial_ends_at: newDate } as any)
        .eq("subscription_tier", "free")
        .not("trial_ends_at", "is", null)
        .select("id");
      if (error) throw error;
      const count = data?.length ?? 0;
      setState("done");
      toast({ title: "Trial Extended", description: `Extended ${count} active trials by ${days} days` });
      setTimeout(() => setState("idle"), 5000);
    } catch (e: any) {
      setState("error");
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setTimeout(() => setState("idle"), 5000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min="1"
        max="90"
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className="h-8 w-20 text-xs"
        placeholder="days"
      />
      <Button size="sm" variant="outline" onClick={run} disabled={state === "running"} className="h-8 text-xs gap-1.5 flex-1">
        {state === "running" ? <Loader2 size={12} className="animate-spin" /> :
         state === "done" ? <CheckCircle2 size={12} className="text-green-400" /> :
         <Clock size={12} />}
        {state === "running" ? "Extending…" : state === "done" ? "Done!" : "Extend All Trials"}
      </Button>
    </div>
  );
}

// ─── Global Announcement Banner ────────────────────────────────────────────────
function GlobalAnnouncement() {
  const [msg, setMsg] = useState("");
  const [state, setState] = useState<ActionState>("idle");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: current } = useQuery({
    queryKey: ["global-announcement"],
    queryFn: async () => {
      const { data } = await supabase.from("site_content" as any)
        .select("content").eq("key", "global_announcement").maybeSingle();
      return (data as any)?.content ?? "";
    },
  });

  const save = async () => {
    setState("running");
    try {
      const { error } = await supabase.from("site_content" as any)
        .upsert({ key: "global_announcement", content: msg, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
      setState("done");
      toast({ title: "Announcement updated", description: msg ? "Banner is live on the site" : "Banner cleared" });
      qc.invalidateQueries({ queryKey: ["global-announcement"] });
      setTimeout(() => setState("idle"), 4000);
    } catch (e: any) {
      setState("error");
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setTimeout(() => setState("idle"), 4000);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-muted-foreground">Current: <span className="text-foreground">{current || "(none)"}</span></div>
      <div className="flex gap-2">
        <Input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Message shown to all users on site…"
          className="h-8 text-xs flex-1"
        />
        <Button size="sm" variant="outline" onClick={save} disabled={state === "running"} className="h-8 text-xs gap-1 flex-shrink-0">
          {state === "running" ? <Loader2 size={11} className="animate-spin" /> :
           state === "done" ? <CheckCircle2 size={11} className="text-green-400" /> : <Megaphone size={11} />}
          {msg ? "Go Live" : "Clear"}
        </Button>
      </div>
    </div>
  );
}

// ─── CSV Export ────────────────────────────────────────────────────────────────
function ExportClientList() {
  const [state, setState] = useState<ActionState>("idle");
  const { toast } = useToast();

  const run = async () => {
    setState("running");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, subscription_tier, created_at, trial_ends_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const rows = [
        ["ID", "Name", "Email", "Tier", "Joined", "Trial Ends"],
        ...(data ?? []).map((p: any) => [
          p.id, p.full_name ?? "", p.email ?? "", p.subscription_tier ?? "",
          p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
          p.trial_ends_at ? new Date(p.trial_ends_at).toLocaleDateString() : "",
        ]),
      ];
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `m2-clients-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setState("done");
      toast({ title: "Export complete", description: `${data?.length} clients exported` });
      setTimeout(() => setState("idle"), 4000);
    } catch (e: any) {
      setState("error");
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
      setTimeout(() => setState("idle"), 4000);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={state === "running"} className="h-8 text-xs gap-1.5 w-full">
      {state === "running" ? <Loader2 size={11} className="animate-spin" /> :
       state === "done" ? <CheckCircle2 size={11} className="text-green-400" /> : <Download size={11} />}
      {state === "running" ? "Exporting…" : state === "done" ? "Download started!" : "Export Client List CSV"}
    </Button>
  );
}

// ─── Bulk Triage All Support ───────────────────────────────────────────────────
function BulkSupportTriage() {
  const [state, setState] = useState<ActionState>("idle");
  const [progress, setProgress] = useState("");
  const { toast } = useToast();

  const run = async () => {
    setState("running");
    try {
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("status", "open")
        .limit(20);
      if (!tickets?.length) {
        setState("done");
        toast({ title: "All clear", description: "No open tickets to triage" });
        setTimeout(() => setState("idle"), 4000);
        return;
      }
      let done = 0;
      for (const t of tickets) {
        setProgress(`${done}/${tickets.length}`);
        await supabase.functions.invoke("ai-support-triage", { body: { ticket_id: t.id } });
        done++;
      }
      setState("done");
      toast({ title: "Triage complete", description: `${done} tickets triaged by AI` });
      setTimeout(() => setState("idle"), 5000);
    } catch (e: any) {
      setState("error");
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setTimeout(() => setState("idle"), 5000);
    } finally {
      setProgress("");
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={state === "running"} className="h-8 text-xs gap-1.5 w-full">
      {state === "running" ? <Loader2 size={11} className="animate-spin" /> :
       state === "done" ? <CheckCircle2 size={11} className="text-green-400" /> : <Bot size={11} />}
      {state === "running" ? `AI Triaging… ${progress}` : state === "done" ? "Done!" : "AI Triage All Open Tickets"}
    </Button>
  );
}

// ─── Bulk Approve AI Queue ─────────────────────────────────────────────────────
function BulkApproveAIQueue() {
  const [state, setState] = useState<ActionState>("idle");
  const { toast } = useToast();
  const qc = useQueryClient();

  const run = async () => {
    setState("running");
    try {
      const { data, error } = await supabase
        .from("ai_action_queue")
        .update({ status: "approved", reviewed_at: new Date().toISOString() } as any)
        .eq("status", "pending")
        .select("id");
      if (error) throw error;
      setState("done");
      toast({ title: "AI Queue cleared", description: `${data?.length ?? 0} items approved` });
      qc.invalidateQueries({ queryKey: ["pending-ai-queue-count"] });
      setTimeout(() => setState("idle"), 5000);
    } catch (e: any) {
      setState("error");
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setTimeout(() => setState("idle"), 5000);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={state === "running"} className="h-8 text-xs gap-1.5 w-full">
      {state === "running" ? <Loader2 size={11} className="animate-spin" /> :
       state === "done" ? <CheckCircle2 size={11} className="text-green-400" /> : <CheckCircle2 size={11} />}
      {state === "running" ? "Approving…" : state === "done" ? "Approved!" : "Approve All AI Queue"}
    </Button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminCommandDeck() {
  const QUICK_ACTIONS: QuickAction[] = [
    {
      id: "stripe-sync",
      label: "Stripe Sync",
      desc: "Force-sync all subscription tiers from Stripe",
      icon: RefreshCw,
      color: "bg-violet-500/20 text-violet-400",
      category: "Finance",
      fn: async () => {
        const { data, error } = await supabase.functions.invoke("force-stripe-sync");
        if (error) throw error;
        return `Updated ${data?.updated ?? 0} accounts`;
      },
    },
    {
      id: "publish-workout",
      label: "Publish Today's Workout",
      desc: "Generate + publish a new daily workout now",
      icon: Play,
      color: "bg-green-500/20 text-green-400",
      category: "Training",
      fn: async () => {
        const { data, error } = await supabase.functions.invoke("generate-daily-workouts", {
          body: { quantity: 1, style: "Traditional", publish: true },
        });
        if (error) throw error;
        return `Workout published`;
      },
    },
    {
      id: "gbp-post",
      label: "Post to GBP Now",
      desc: "Skip the schedule — post to Google Business now",
      icon: Globe,
      color: "bg-blue-500/20 text-blue-400",
      category: "Marketing",
      fn: async () => {
        const { error } = await supabase.functions.invoke("gbp-saas-poster");
        if (error) throw error;
        return "GBP posts sent to all active clients";
      },
    },
    {
      id: "social-post",
      label: "Fire Social Posts Now",
      desc: "Trigger social media posts for all clients now",
      icon: Megaphone,
      color: "bg-pink-500/20 text-pink-400",
      category: "Marketing",
      fn: async () => {
        const { error } = await supabase.functions.invoke("social-media-poster");
        if (error) throw error;
        return "Social posts queued for all clients";
      },
    },
    {
      id: "prospect",
      label: "Run Prospecting",
      desc: "Trigger local business prospecting now",
      icon: TrendingUp,
      color: "bg-orange-500/20 text-orange-400",
      category: "Growth",
      fn: async () => {
        const { error } = await supabase.functions.invoke("prospect-local-businesses");
        if (error) throw error;
        return "Prospecting run complete";
      },
    },
    {
      id: "newsletter-send",
      label: "Send Newsletter Now",
      desc: "Override Monday schedule — send newsletter today",
      icon: Send,
      color: "bg-cyan-500/20 text-cyan-400",
      category: "Comms",
      fn: async () => {
        const { data, error } = await supabase.functions.invoke("newsletter-send");
        if (error) throw error;
        return `Sent to ${data?.sent ?? "subscribers"}`;
      },
    },
    {
      id: "contractor-leads",
      label: "Run Lead Notify",
      desc: "Check & notify contractor clients of new leads",
      icon: UserPlus,
      color: "bg-yellow-500/20 text-yellow-400",
      category: "Products",
      fn: async () => {
        const { error } = await supabase.functions.invoke("contractor-lead-notify");
        if (error) throw error;
        return "Lead notifications sent";
      },
    },
    {
      id: "review-monitor",
      label: "Run Review Monitor",
      desc: "Check for new reviews across all clients now",
      icon: Star,
      color: "bg-amber-500/20 text-amber-400",
      category: "Products",
      fn: async () => {
        const { error } = await supabase.functions.invoke("review-monitor");
        if (error) throw error;
        return "Review monitor complete";
      },
    },
    {
      id: "sms-blast",
      label: "Fire SMS Blast",
      desc: "Trigger weekly SMS blast for all clients now",
      icon: Zap,
      color: "bg-lime-500/20 text-lime-400",
      category: "Products",
      fn: async () => {
        const { error } = await supabase.functions.invoke("weekly-sms-sender");
        if (error) throw error;
        return "SMS blast triggered";
      },
    },
    {
      id: "slow-day",
      label: "Slow Day Trigger",
      desc: "Send slow-day SMS to all slow_day_clients now",
      icon: Activity,
      color: "bg-teal-500/20 text-teal-400",
      category: "Products",
      fn: async () => {
        const { error } = await supabase.functions.invoke("slow-day-trigger");
        if (error) throw error;
        return "Slow day messages sent";
      },
    },
    {
      id: "estimate-drip",
      label: "Run Estimate Drip",
      desc: "Send estimate follow-up drip emails now",
      icon: Mail,
      color: "bg-indigo-500/20 text-indigo-400",
      category: "Products",
      fn: async () => {
        const { error } = await supabase.functions.invoke("estimate-drip-runner");
        if (error) throw error;
        return "Estimate drip emails sent";
      },
    },
    {
      id: "invoice-chaser",
      label: "Run Invoice Chaser",
      desc: "Chase unpaid invoices for all clients",
      icon: DollarSign,
      color: "bg-red-500/20 text-red-400",
      category: "Products",
      fn: async () => {
        const { error } = await supabase.functions.invoke("invoice-chaser-runner");
        if (error) throw error;
        return "Invoice chaser emails sent";
      },
    },
    {
      id: "abandoned-cart",
      label: "Cart Recovery Blast",
      desc: "Send cart recovery emails to all abandoned checkouts",
      icon: RotateCcw,
      color: "bg-purple-500/20 text-purple-400",
      category: "Growth",
      fn: async () => {
        const { error } = await supabase.functions.invoke("abandoned-cart-sender");
        if (error) throw error;
        return "Cart recovery emails sent";
      },
    },
    {
      id: "churn-preventer",
      label: "Churn Prevention",
      desc: "Detect at-risk clients and trigger re-engagement sequences",
      icon: Shield,
      color: "bg-rose-500/20 text-rose-400",
      category: "Growth",
      fn: async () => {
        const { error } = await supabase.functions.invoke("ai-churn-preventer");
        if (error) throw error;
        return "Churn prevention sequences triggered";
      },
    },
    {
      id: "email-queue",
      label: "Flush Email Queue",
      desc: "Force-process any stuck or pending emails in the queue",
      icon: Mail,
      color: "bg-sky-500/20 text-sky-400",
      category: "Comms",
      fn: async () => {
        const { error } = await supabase.functions.invoke("process-email-queue");
        if (error) throw error;
        return "Email queue flushed";
      },
    },
    {
      id: "multi-drip",
      label: "Multi-Service Drip",
      desc: "Kick off the full multi-product lifecycle drip now",
      icon: Zap,
      color: "bg-emerald-500/20 text-emerald-400",
      category: "Products",
      fn: async () => {
        const { error } = await supabase.functions.invoke("multi-service-drip");
        if (error) throw error;
        return "Multi-service drip triggered";
      },
    },
  ];

  const categories = Array.from(new Set(QUICK_ACTIONS.map((a) => a.category)));

  return (
    <div className="space-y-6">
      {/* System health */}
      <SystemHealth />

      {/* Quick fire actions grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap size={14} className="text-primary" />
            Quick Fire Actions
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">One tap to run any automation. Each button triggers the full automated chain.</p>
        </CardHeader>
        <CardContent>
          {categories.map((cat) => (
            <div key={cat} className="mb-5">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">{cat}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_ACTIONS.filter((a) => a.category === cat).map((action) => (
                  <ActionButton key={action.id} action={action} />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Power Tools */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench size={14} className="text-primary" />
            Power Tools
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">Bulk operations and system controls.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Bulk Approve AI Queue</Label>
            <BulkApproveAIQueue />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">AI Triage All Open Support Tickets</Label>
            <BulkSupportTriage />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Mass Trial Extension</Label>
            <MassTrialExtension />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Export Client List</Label>
            <ExportClientList />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Global Announcement Banner</Label>
            <GlobalAnnouncement />
          </div>
        </CardContent>
      </Card>

      {/* AI Model Selector */}
      <AIModelSelector />
    </div>
  );
}
