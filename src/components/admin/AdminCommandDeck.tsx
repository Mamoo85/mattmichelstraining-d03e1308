import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type ActionState = "idle" | "running" | "done" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function lastUpdatedLabel(dataUpdatedAt: number): string {
  if (!dataUpdatedAt) return "";
  const secs = Math.floor((Date.now() - dataUpdatedAt) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

// ─── Scanline CSS (injected once) ─────────────────────────────────────────────
const SCANLINE_CSS = `
@keyframes deathstar-scanline {
  0% { transform: translateY(-100vh); }
  100% { transform: translateY(100vh); }
}
.ds-scanline {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0,212,255,0.08), transparent);
  pointer-events: none;
  z-index: 9999;
  animation: deathstar-scanline 8s linear infinite;
}
@keyframes ds-pulse-ring {
  0% { box-shadow: 0 0 0 0 currentColor; }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.ds-pulse { animation: ds-pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite; }
`;

// ─── Agent role map ───────────────────────────────────────────────────────────
const AGENT_ROLES: Record<string, string> = {
  oz: "GROWTH OPS", tom: "LEAD HUNTER", shield: "CHURN OPS", cashier: "REVENUE WATCH",
  pulse: "SMS HEALTH", scout: "COMP INTEL", hype: "SOCIAL PROOF", drill: "CONTENT OPS",
  ref: "REFERRALS", selma: "MARKETING", scarlett: "AD STRATEGY", ops: "FULFILLMENT", mute: "OPT-OUT GUARD",
};
const AGENTS = ["Oz", "Tom", "Shield", "Cashier", "Pulse", "Scout", "Hype", "Drill", "Ref", "Selma", "Scarlett", "Ops", "Mute"];

// ─── Quick Action definitions (all existing invoke calls preserved) ───────────
interface QA { id: string; label: string; group: string; fn: () => Promise<string>; }

const QUICK_ACTIONS: QA[] = [
  { id: "stripe-sync", label: "STRIPE SYNC", group: "SYSTEMS", fn: async () => { const { data, error } = await supabase.functions.invoke("force-stripe-sync"); if (error) throw error; return `Updated ${data?.updated ?? 0} accounts`; } },
  { id: "publish-workout", label: "PUBLISH WORKOUT", group: "TRAINING", fn: async () => { const { data, error } = await supabase.functions.invoke("generate-daily-workouts", { body: { quantity: 1, style: "Traditional", publish: true } }); if (error) throw error; return "Workout published"; } },
  { id: "gbp-post", label: "POST TO GBP", group: "MARKETING", fn: async () => { const { error } = await supabase.functions.invoke("gbp-saas-poster"); if (error) throw error; return "GBP posts sent"; } },
  { id: "social-post", label: "FIRE SOCIAL POSTS", group: "MARKETING", fn: async () => { const { error } = await supabase.functions.invoke("social-media-poster"); if (error) throw error; return "Social posts queued"; } },
  { id: "prospect", label: "RUN PROSPECTING", group: "MARKETING", fn: async () => { const { error } = await supabase.functions.invoke("prospect-local-businesses"); if (error) throw error; return "Prospecting complete"; } },
  { id: "abandoned-cart", label: "CART RECOVERY", group: "GROWTH", fn: async () => { const { error } = await supabase.functions.invoke("abandoned-cart-sender"); if (error) throw error; return "Cart recovery sent"; } },
  { id: "churn-preventer", label: "CHURN PREVENTION", group: "GROWTH", fn: async () => { const { error } = await supabase.functions.invoke("ai-churn-preventer"); if (error) throw error; return "Churn prevention triggered"; } },
  { id: "newsletter-send", label: "SEND NEWSLETTER", group: "COMMS", fn: async () => { const { data, error } = await supabase.functions.invoke("newsletter-send"); if (error) throw error; return `Sent to ${data?.sent ?? "subscribers"}`; } },
  { id: "email-queue", label: "FLUSH EMAIL QUEUE", group: "COMMS", fn: async () => { const { error } = await supabase.functions.invoke("process-email-queue"); if (error) throw error; return "Queue flushed"; } },
  { id: "contractor-leads", label: "LEAD NOTIFY", group: "PRODUCTS", fn: async () => { const { error } = await supabase.functions.invoke("contractor-lead-notify"); if (error) throw error; return "Lead notifications sent"; } },
  { id: "review-monitor", label: "REVIEW MONITOR", group: "PRODUCTS", fn: async () => { const { error } = await supabase.functions.invoke("review-monitor"); if (error) throw error; return "Review monitor complete"; } },
  { id: "sms-blast", label: "SMS BLAST", group: "PRODUCTS", fn: async () => { const { error } = await supabase.functions.invoke("weekly-sms-sender"); if (error) throw error; return "SMS blast triggered"; } },
  { id: "slow-day", label: "SLOW DAY TRIGGER", group: "PRODUCTS", fn: async () => { const { error } = await supabase.functions.invoke("slow-day-trigger"); if (error) throw error; return "Slow day sent"; } },
  { id: "estimate-drip", label: "ESTIMATE DRIP", group: "PRODUCTS", fn: async () => { const { error } = await supabase.functions.invoke("estimate-drip-runner"); if (error) throw error; return "Drip sent"; } },
  { id: "invoice-chaser", label: "INVOICE CHASER", group: "PRODUCTS", fn: async () => { const { error } = await supabase.functions.invoke("invoice-chaser-runner"); if (error) throw error; return "Chaser sent"; } },
  { id: "multi-drip", label: "MULTI-SERVICE DRIP", group: "PRODUCTS", fn: async () => { const { error } = await supabase.functions.invoke("multi-service-drip"); if (error) throw error; return "Multi drip triggered"; } },
];

const DESTRUCTIVE_IDS = ["newsletter-send", "sms-blast"];

// ─── Sector Header ────────────────────────────────────────────────────────────
function SectorHeader({ children, updatedAt }: { children: React.ReactNode; updatedAt?: number }) {
  const [, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 5000); return () => clearInterval(i); }, []);
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-semibold font-mono tracking-widest text-[#00d4ff]/80 uppercase">{children}</h3>
      {updatedAt ? <span className="text-[9px] font-mono text-[#00d4ff]/30">updated {lastUpdatedLabel(updatedAt)}</span> : null}
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ open, onConfirm, onCancel, label }: { open: boolean; onConfirm: () => void; onCancel: () => void; label: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#0a1628] border border-[#00d4ff]/20 p-6 rounded-lg max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold text-white font-mono">⚠ CONFIRM: {label}</p>
        <p className="text-xs text-white/50">This action will execute immediately.</p>
        <div className="flex gap-2">
          <button onClick={onConfirm} className="flex-1 px-3 py-2 rounded border border-red-500/50 bg-red-500/10 text-red-400 text-xs font-mono hover:bg-red-500/20 transition-colors">CONFIRM</button>
          <button onClick={onCancel} className="flex-1 px-3 py-2 rounded border border-white/10 text-white/40 text-xs font-mono hover:border-white/20 transition-colors">CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// ─── Weapon Button ────────────────────────────────────────────────────────────
function WeaponButton({ action }: { action: QA }) {
  const [state, setState] = useState<ActionState>("idle");
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();
  const needsConfirm = DESTRUCTIVE_IDS.includes(action.id);

  const execute = async () => {
    setState("running");
    try {
      const msg = await action.fn();
      setState("done");
      toast({ title: action.label, description: msg });
      setTimeout(() => setState("idle"), 1500);
    } catch (e: any) {
      setState("error");
      toast({ title: action.label, description: e?.message ?? "Error", variant: "destructive" });
      setTimeout(() => setState("idle"), 1500);
    }
  };

  const borderColor = state === "done" ? "border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
    : state === "error" ? "border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
    : "border-[#00d4ff]/30 hover:border-[#00d4ff]/60";

  return (
    <>
      <ConfirmDialog open={showConfirm} onConfirm={() => { setShowConfirm(false); execute(); }} onCancel={() => setShowConfirm(false)} label={action.label} />
      <button
        onClick={() => needsConfirm ? setShowConfirm(true) : execute()}
        disabled={state === "running"}
        className={`px-3 py-2 rounded border bg-[#00d4ff]/5 text-[#00d4ff] text-[10px] font-mono font-bold tracking-wider transition-all whitespace-nowrap disabled:opacity-50 hover:bg-[#00d4ff]/15 ${borderColor}`}
      >
        {state === "running" ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
        {state === "done" ? "✓ " : state === "error" ? "✗ " : ""}{action.label}
      </button>
    </>
  );
}

// ─── AI Model Selector (preserved) ────────────────────────────────────────────
const AI_MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", desc: "Fast · Default" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", desc: "Balanced" },
  { id: "claude-opus-4-6", label: "Opus 4.6", desc: "Best quality" },
];
const AI_TASK_TYPES = [
  { key: "content_generation", label: "Content" }, { key: "workout_generation", label: "Workouts" },
  { key: "newsletter", label: "Newsletter" }, { key: "support_triage", label: "Support" },
  { key: "coach_replies", label: "Coach" }, { key: "outreach", label: "Outreach" }, { key: "reports", label: "Reports" },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AdminCommandDeck() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [clock, setClock] = useState(new Date());
  const [, forceUpdate] = useState(0);

  // Live clock
  useEffect(() => { const i = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(i); }, []);

  // Inject scanline CSS once
  useEffect(() => {
    if (document.getElementById("ds-scanline-style")) return;
    const style = document.createElement("style");
    style.id = "ds-scanline-style";
    style.textContent = SCANLINE_CSS;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // ─── SECTOR A: Intelligence Bar queries ──────────────────────────────────────
  const intelQuery = useQuery({
    queryKey: ["ds-intelligence-bar"],
    queryFn: async () => {
      const now24h = new Date(Date.now() - 86400000).toISOString();
      const [contractors, hireAlert, fieldCrm, smsSent, emailSent, failedComms] = await Promise.all([
        supabase.from("contractor_clients").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("hire_alert_clients").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("field_crm_clients").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("system_comms_log").select("id", { count: "exact", head: true }).eq("channel", "sms").eq("status", "sent").gte("created_at", now24h),
        supabase.from("system_comms_log").select("id", { count: "exact", head: true }).eq("channel", "email").eq("status", "sent").gte("created_at", now24h),
        supabase.from("system_comms_log").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", now24h),
      ]);
      return {
        activeSubs: (contractors.count ?? 0) + (hireAlert.count ?? 0) + (fieldCrm.count ?? 0),
        sms24h: smsSent.count ?? 0,
        email24h: emailSent.count ?? 0,
        failed24h: failedComms.count ?? 0,
      };
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // ─── SECTOR B: Agent heartbeats ──────────────────────────────────────────────
  const agentQuery = useQuery({
    queryKey: ["ds-agent-heartbeats"],
    queryFn: async () => {
      const { data } = await supabase.from("agent_heartbeats").select("agent_name, last_beat, metadata").order("agent_name");
      return data || [];
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // ─── SECTOR C: Live comms feed ───────────────────────────────────────────────
  const commsQuery = useQuery({
    queryKey: ["ds-comms-feed"],
    queryFn: async () => {
      const { data } = await supabase.from("system_comms_log")
        .select("channel, product, recipient, body_preview, status, created_at, edge_function")
        .order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // ─── SECTOR D: Threat board ──────────────────────────────────────────────────
  const threatQuery = useQuery({
    queryKey: ["ds-threat-board"],
    queryFn: async () => {
      const now24h = new Date(Date.now() - 86400000).toISOString();
      const now14d = new Date(Date.now() + 14 * 86400000).toISOString();
      const [failedComms, licenses] = await Promise.all([
        supabase.from("system_comms_log").select("edge_function, error_message").eq("status", "failed").gte("created_at", now24h),
        supabase.from("license_monitor_items" as any).select("license_name, expiry_date, client_id").gte("expiry_date", new Date().toISOString()).lte("expiry_date", now14d).order("expiry_date").limit(5),
      ]);

      // Group failures by edge_function
      const failMap: Record<string, { count: number; lastError: string }> = {};
      (failedComms.data || []).forEach((r: any) => {
        const fn = r.edge_function || "unknown";
        if (!failMap[fn]) failMap[fn] = { count: 0, lastError: "" };
        failMap[fn].count++;
        failMap[fn].lastError = r.error_message || "";
      });
      const topFailures = Object.entries(failMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5);

      return { topFailures, licenses: licenses.data || [] };
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // ─── SECTOR F: Revenue panels ────────────────────────────────────────────────
  const revenueQuery = useQuery({
    queryKey: ["ds-revenue-panels"],
    queryFn: async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const week7d = new Date(Date.now() - 7 * 86400000).toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const [cActive, cLeads, cRevenue, tPaid, tTrials, tCandidates7d, tHot, fActive, fToday, fCompleted7d] = await Promise.all([
        supabase.from("contractor_clients").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("contractor_leads").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
        supabase.from("contractor_leads").select("payment_amount_cents").eq("status", "sold").gte("created_at", monthStart),
        supabase.from("hire_alert_clients").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("hire_alert_clients").select("id", { count: "exact", head: true }).eq("trial_status", "active"),
        supabase.from("hire_alert_candidates").select("id", { count: "exact", head: true }).gte("created_at", week7d),
        supabase.from("hire_alert_candidates").select("id", { count: "exact", head: true }).gte("availability_score", 8).gte("created_at", week7d),
        supabase.from("field_crm_clients").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("field_service_jobs").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("field_service_jobs").select("id", { count: "exact", head: true }).eq("status", "completed").gte("updated_at", week7d),
      ]);
      const rev = ((cRevenue.data || []) as any[]).reduce((s, r) => s + (r.payment_amount_cents || 0), 0) / 100;
      return {
        contractor: { active: cActive.count ?? 0, leads: cLeads.count ?? 0, revenue: rev },
        techAlert: { paid: tPaid.count ?? 0, trials: tTrials.count ?? 0, candidates7d: tCandidates7d.count ?? 0, hot: tHot.count ?? 0 },
        fieldDesk: { active: fActive.count ?? 0, today: fToday.count ?? 0, completed7d: fCompleted7d.count ?? 0 },
      };
    },
    staleTime: 300000,
    refetchInterval: 300000,
  });

  // ─── SECTOR G: Comms volume chart ────────────────────────────────────────────
  const chartQuery = useQuery({
    queryKey: ["ds-comms-chart"],
    queryFn: async () => {
      const now24h = new Date(Date.now() - 86400000).toISOString();
      const { data } = await supabase.from("system_comms_log")
        .select("channel, created_at")
        .gte("created_at", now24h);
      // Group by hour
      const hourMap: Record<string, { sms: number; email: number }> = {};
      (data || []).forEach((r: any) => {
        const hr = new Date(r.created_at).getHours();
        const label = `${hr % 12 || 12}${hr >= 12 ? "p" : "a"}`;
        if (!hourMap[label]) hourMap[label] = { sms: 0, email: 0 };
        if (r.channel === "sms") hourMap[label].sms++;
        else hourMap[label].email++;
      });
      return Object.entries(hourMap).map(([hour, v]) => ({ hour, ...v }));
    },
    staleTime: 300000,
    refetchInterval: 300000,
  });

  // ─── Agent helpers ───────────────────────────────────────────────────────────
  const getAgentData = (name: string) => {
    const beat = (agentQuery.data || []).find((h: any) => h.agent_name === name.toLowerCase());
    if (!beat) return { status: "unknown" as const, minsAgo: null, mission: AGENT_ROLES[name.toLowerCase()] || "STANDBY", meta: null };
    const meta = beat.metadata as Record<string, any> | null;
    const mins = Math.floor((Date.now() - new Date(beat.last_beat).getTime()) / 60000);
    let status: "online" | "warning" | "offline" | "unknown" = "online";
    if (meta?.last_status === "error") status = "offline";
    else if (mins > 120) status = "offline";
    else if (mins > 30) status = "warning";
    return { status, minsAgo: mins, mission: (meta?.last_action as string) || AGENT_ROLES[name.toLowerCase()] || "STANDBY", meta };
  };

  const deadAgents = AGENTS.filter(a => getAgentData(a).status === "offline");

  // ─── Grouped quick actions ──────────────────────────────────────────────────
  const groups = useMemo(() => {
    const g: Record<string, QA[]> = {};
    QUICK_ACTIONS.forEach(a => { (g[a.group] ??= []).push(a); });
    return g;
  }, []);

  // ─── Power tool states ──────────────────────────────────────────────────────
  const [trialDays, setTrialDays] = useState("7");
  const [trialState, setTrialState] = useState<ActionState>("idle");
  const [bulkAIState, setBulkAIState] = useState<ActionState>("idle");
  const [triageState, setTriageState] = useState<ActionState>("idle");
  const [exportState, setExportState] = useState<ActionState>("idle");
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [announcementState, setAnnouncementState] = useState<ActionState>("idle");

  const { data: currentAnnouncement } = useQuery({
    queryKey: ["global-announcement"],
    queryFn: async () => {
      const { data } = await supabase.from("site_content" as any).select("content").eq("key", "global_announcement").maybeSingle();
      return (data as any)?.content ?? "";
    },
  });

  // Power tool handlers (all preserved from original)
  const runTrialExtension = async () => {
    if (!trialDays || isNaN(Number(trialDays))) return;
    setTrialState("running");
    try {
      const newDate = new Date(Date.now() + Number(trialDays) * 86400000).toISOString();
      const { data, error } = await supabase.from("profiles").update({ trial_started_at: newDate } as any).eq("subscription_tier", "free").not("trial_started_at", "is", null).select("id");
      if (error) throw error;
      setTrialState("done");
      toast({ title: "Trial Extended", description: `Extended ${data?.length ?? 0} trials by ${trialDays} days` });
      setTimeout(() => setTrialState("idle"), 3000);
    } catch (e: any) { setTrialState("error"); toast({ title: "Error", description: e.message, variant: "destructive" }); setTimeout(() => setTrialState("idle"), 3000); }
  };

  const runBulkAI = async () => {
    setBulkAIState("running");
    try {
      const { data, error } = await supabase.from("ai_action_queue").update({ status: "approved", reviewed_at: new Date().toISOString() } as any).eq("status", "pending").select("id");
      if (error) throw error;
      setBulkAIState("done");
      toast({ title: "AI Queue cleared", description: `${data?.length ?? 0} items approved` });
      qc.invalidateQueries({ queryKey: ["pending-ai-queue-count"] });
      setTimeout(() => setBulkAIState("idle"), 3000);
    } catch (e: any) { setBulkAIState("error"); toast({ title: "Error", description: e.message, variant: "destructive" }); setTimeout(() => setBulkAIState("idle"), 3000); }
  };

  const runTriage = async () => {
    setTriageState("running");
    try {
      const { data: tickets } = await supabase.from("support_tickets").select("id").eq("status", "open").limit(20);
      if (!tickets?.length) { setTriageState("done"); toast({ title: "All clear", description: "No open tickets" }); setTimeout(() => setTriageState("idle"), 3000); return; }
      for (const t of tickets) await supabase.functions.invoke("ai-support-triage", { body: { ticket_id: t.id } });
      setTriageState("done");
      toast({ title: "Triage complete", description: `${tickets.length} tickets triaged` });
      setTimeout(() => setTriageState("idle"), 3000);
    } catch (e: any) { setTriageState("error"); toast({ title: "Error", description: e.message, variant: "destructive" }); setTimeout(() => setTriageState("idle"), 3000); }
  };

  const runExport = async () => {
    setExportState("running");
    try {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email, subscription_tier, created_at, trial_started_at").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      const rows = [["ID","Name","Email","Tier","Joined","Trial Started"], ...(data ?? []).map((p: any) => [p.id, p.full_name ?? "", p.email ?? "", p.subscription_tier ?? "", p.created_at ? new Date(p.created_at).toLocaleDateString() : "", p.trial_started_at ? new Date(p.trial_started_at).toLocaleDateString() : ""])];
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `m2-clients-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
      setExportState("done");
      toast({ title: "Export complete", description: `${data?.length} clients exported` });
      setTimeout(() => setExportState("idle"), 3000);
    } catch (e: any) { setExportState("error"); toast({ title: "Error", description: e.message, variant: "destructive" }); setTimeout(() => setExportState("idle"), 3000); }
  };

  const saveAnnouncement = async () => {
    setAnnouncementState("running");
    try {
      const { error } = await supabase.from("site_content" as any).upsert({ key: "global_announcement", content: announcementMsg, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
      setAnnouncementState("done");
      toast({ title: "Announcement updated", description: announcementMsg ? "Banner is live" : "Banner cleared" });
      qc.invalidateQueries({ queryKey: ["global-announcement"] });
      setTimeout(() => setAnnouncementState("idle"), 3000);
    } catch (e: any) { setAnnouncementState("error"); toast({ title: "Error", description: e.message, variant: "destructive" }); setTimeout(() => setAnnouncementState("idle"), 3000); }
  };

  // AI Model selector helpers
  const getModel = (taskKey: string) => localStorage.getItem(`ai-model-${taskKey}`) ?? "claude-haiku-4-5-20251001";
  const setModel = (taskKey: string, modelId: string) => { localStorage.setItem(`ai-model-${taskKey}`, modelId); forceUpdate(n => n + 1); };

  // Error state component
  const SensorOffline = ({ onRetry }: { onRetry: () => void }) => (
    <div className="flex items-center gap-2 text-amber-500 font-mono text-xs py-4">
      <span>⚠ SENSOR OFFLINE — RECONNECTING...</span>
      <button onClick={onRetry} className="px-2 py-0.5 border border-amber-500/30 rounded text-[10px] hover:bg-amber-500/10">RETRY</button>
    </div>
  );

  const intel = intelQuery.data;

  return (
    <div className="min-h-screen bg-[#030711] text-white relative" style={{ backgroundImage: "linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px" }}>
      {/* Scanline sweep */}
      <div className="ds-scanline" />

      <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">

        {/* ═══════ SECTOR A — IMPERIAL INTELLIGENCE BAR ═══════ */}
        <div className="border-b border-[#00d4ff]/20 pb-4">
          <div className="flex flex-wrap items-center gap-4 md:gap-6 justify-between">
            {intelQuery.isError ? <SensorOffline onRetry={() => intelQuery.refetch()} /> : (
              <>
                <KPI label="ACTIVE SUBS" value={intel?.activeSubs ?? "—"} />
                <Divider />
                <KPI label="SMS 24H" value={intel?.sms24h ?? "—"} />
                <Divider />
                <KPI label="EMAIL 24H" value={intel?.email24h ?? "—"} />
                <Divider />
                <KPI label="FAILED" value={intel?.failed24h ?? 0} alert={(intel?.failed24h ?? 0) > 0} />
                <Divider />
                <KPI label="LOCAL" value={clock.toLocaleTimeString()} />
              </>
            )}
          </div>
        </div>

        {/* ═══════ SECTOR E — WEAPONS ARRAY (mobile: right after intel bar) ═══════ */}
        <div className="order-2 md:order-none">
          <SectorHeader>⚡ WEAPONS ARRAY — QUICK FIRE CONTROLS</SectorHeader>
          <div className="space-y-4">
            {Object.entries(groups).map(([group, actions]) => (
              <div key={group}>
                <div className="text-[9px] font-mono font-bold text-[#00d4ff]/40 tracking-[0.2em] mb-2">◈ {group}</div>
                <div className="flex flex-wrap gap-2">
                  {actions.map(a => <WeaponButton key={a.id} action={a} />)}
                </div>
              </div>
            ))}
          </div>

          {/* HEAVY ORDINANCE — always visible */}
          <div className="mt-4 pt-4 border-t border-[#00d4ff]/10">
            <div className="text-[9px] font-mono font-bold text-[#00d4ff]/40 tracking-[0.2em] mb-3">◈ HEAVY ORDINANCE</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Mass Trial Extension */}
              <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-lg p-3">
                <div className="text-[9px] font-mono text-[#00d4ff]/50 mb-2">MASS TRIAL EXTENSION</div>
                <div className="flex gap-2">
                  <Input type="number" min="1" max="90" value={trialDays} onChange={e => setTrialDays(e.target.value)} className="h-7 w-16 text-xs bg-transparent border-[#00d4ff]/20 text-[#00d4ff] font-mono" />
                  <button onClick={runTrialExtension} disabled={trialState === "running"} className="flex-1 h-7 px-2 rounded border border-[#00d4ff]/30 bg-[#00d4ff]/5 text-[#00d4ff] text-[10px] font-mono font-bold hover:bg-[#00d4ff]/15 transition-colors disabled:opacity-50">
                    {trialState === "running" ? "EXTENDING..." : trialState === "done" ? "✓ DONE" : "EXTEND ALL"}
                  </button>
                </div>
              </div>
              {/* Bulk AI Queue */}
              <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-lg p-3">
                <div className="text-[9px] font-mono text-[#00d4ff]/50 mb-2">BULK APPROVE AI QUEUE</div>
                <button onClick={runBulkAI} disabled={bulkAIState === "running"} className="w-full h-7 px-2 rounded border border-[#00d4ff]/30 bg-[#00d4ff]/5 text-[#00d4ff] text-[10px] font-mono font-bold hover:bg-[#00d4ff]/15 transition-colors disabled:opacity-50">
                  {bulkAIState === "running" ? "APPROVING..." : bulkAIState === "done" ? "✓ APPROVED" : "APPROVE ALL"}
                </button>
              </div>
              {/* AI Support Triage */}
              <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-lg p-3">
                <div className="text-[9px] font-mono text-[#00d4ff]/50 mb-2">AI TRIAGE OPEN TICKETS</div>
                <button onClick={runTriage} disabled={triageState === "running"} className="w-full h-7 px-2 rounded border border-[#00d4ff]/30 bg-[#00d4ff]/5 text-[#00d4ff] text-[10px] font-mono font-bold hover:bg-[#00d4ff]/15 transition-colors disabled:opacity-50">
                  {triageState === "running" ? "TRIAGING..." : triageState === "done" ? "✓ DONE" : "TRIAGE ALL"}
                </button>
              </div>
              {/* Export */}
              <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-lg p-3">
                <div className="text-[9px] font-mono text-[#00d4ff]/50 mb-2">EXPORT CLIENT LIST</div>
                <button onClick={runExport} disabled={exportState === "running"} className="w-full h-7 px-2 rounded border border-[#00d4ff]/30 bg-[#00d4ff]/5 text-[#00d4ff] text-[10px] font-mono font-bold hover:bg-[#00d4ff]/15 transition-colors disabled:opacity-50">
                  {exportState === "running" ? "EXPORTING..." : exportState === "done" ? "✓ DOWNLOADED" : "EXPORT CSV"}
                </button>
              </div>
              {/* Announcement */}
              <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-lg p-3 sm:col-span-2">
                <div className="text-[9px] font-mono text-[#00d4ff]/50 mb-2">GLOBAL ANNOUNCEMENT {currentAnnouncement ? <span className="text-emerald-400 ml-1">● LIVE</span> : ""}</div>
                {currentAnnouncement && <div className="text-[10px] text-white/40 font-mono mb-1 truncate">Current: {currentAnnouncement}</div>}
                <div className="flex gap-2">
                  <Input value={announcementMsg} onChange={e => setAnnouncementMsg(e.target.value)} placeholder="Message for all users..." className="h-7 text-xs bg-transparent border-[#00d4ff]/20 text-white font-mono flex-1" />
                  <button onClick={saveAnnouncement} disabled={announcementState === "running"} className="h-7 px-3 rounded border border-[#00d4ff]/30 bg-[#00d4ff]/5 text-[#00d4ff] text-[10px] font-mono font-bold hover:bg-[#00d4ff]/15 transition-colors disabled:opacity-50">
                    {announcementState === "running" ? "..." : announcementMsg ? "GO LIVE" : "CLEAR"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ 3-COLUMN GRID: B + C + D ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ═══════ SECTOR B — AGENT GRID ═══════ */}
          <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-xl p-4">
            <SectorHeader updatedAt={agentQuery.dataUpdatedAt}>⬡ AGENT GRID — {AGENTS.length} UNITS</SectorHeader>
            {agentQuery.isError ? <SensorOffline onRetry={() => agentQuery.refetch()} /> : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2">
                {AGENTS.map(name => {
                  const a = getAgentData(name);
                  const ringColor = a.status === "online" ? "text-emerald-500" : a.status === "warning" ? "text-amber-500" : a.status === "offline" ? "text-red-500" : "text-white/20";
                  const glowClass = a.status === "online" ? "shadow-[0_0_12px_rgba(0,212,255,0.3)]" : a.status === "offline" ? "shadow-[0_0_12px_rgba(239,68,68,0.3)]" : "";
                  return (
                    <div key={name} className={`relative flex flex-col items-center justify-center p-2 rounded-lg border border-[#00d4ff]/10 bg-[#030711] min-h-[90px] ${glowClass}`}>
                      <div className={`absolute inset-0 rounded-lg border-2 ${ringColor} ${a.status === "online" ? "ds-pulse" : ""}`} style={{ borderColor: "currentColor" }} />
                      <span className="text-xs font-mono font-bold text-white relative z-10">{name.toUpperCase()}</span>
                      <span className={`text-[9px] font-mono relative z-10 ${ringColor}`}>
                        {a.minsAgo !== null ? (a.minsAgo < 60 ? `${a.minsAgo}m ago` : `${Math.round(a.minsAgo / 60)}h ago`) : "NEVER"}
                      </span>
                      <span className="text-[8px] font-mono text-white/30 relative z-10 text-center leading-tight mt-0.5">{a.mission}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══════ SECTOR C — LIVE COMMS FEED ═══════ */}
          <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-xl p-4">
            <SectorHeader updatedAt={commsQuery.dataUpdatedAt}>
              📡 LIVE COMMS {commsQuery.isFetching && <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse ml-1" />}
            </SectorHeader>
            {commsQuery.isError ? <SensorOffline onRetry={() => commsQuery.refetch()} /> : (
              <div className="max-h-[400px] overflow-y-auto space-y-0.5 scrollbar-thin">
                {(commsQuery.data || []).length === 0 && <div className="text-[10px] font-mono text-white/30 py-4 text-center">NO TRANSMISSIONS</div>}
                {(commsQuery.data || []).map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 py-1 px-1 rounded text-[10px] hover:bg-[#00d4ff]/5 transition-colors">
                    <span className={`px-1 py-0.5 rounded text-[8px] font-mono font-bold ${c.channel === "sms" ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "bg-purple-500/20 text-purple-400"}`}>{c.channel?.toUpperCase()}</span>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.status === "sent" ? "bg-emerald-400" : c.status === "failed" ? "bg-red-400" : "bg-amber-400"}`} />
                    <span className="text-white/30 font-mono truncate max-w-[60px]">{c.product || ""}</span>
                    <span className="text-white/50 font-mono truncate flex-1">{(c.body_preview || "").slice(0, 40)}</span>
                    <span className="text-white/20 font-mono flex-shrink-0">{timeAgo(c.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ═══════ SECTOR D — THREAT BOARD ═══════ */}
          <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-xl p-4">
            <SectorHeader updatedAt={threatQuery.dataUpdatedAt}>🔴 THREAT BOARD — ANOMALY DETECTION</SectorHeader>
            {threatQuery.isError ? <SensorOffline onRetry={() => threatQuery.refetch()} /> : (
              <div className="space-y-4">
                {/* D1: Dead Agents */}
                <div>
                  <div className="text-[9px] font-mono text-amber-500/70 tracking-wider mb-1">DEAD AGENTS</div>
                  {deadAgents.length === 0 ? (
                    <div className="text-[10px] font-mono text-emerald-400">✓ ALL SYSTEMS NOMINAL</div>
                  ) : deadAgents.map(name => {
                    const a = getAgentData(name);
                    return <div key={name} className="text-[10px] font-mono text-amber-400">⚠ {name.toUpperCase()} — LAST CONTACT {a.minsAgo !== null ? (a.minsAgo < 60 ? `${a.minsAgo}m` : `${Math.round(a.minsAgo / 60)}h`) : "NEVER"} AGO</div>;
                  })}
                </div>
                {/* D2: Failed Comms */}
                <div>
                  <div className="text-[9px] font-mono text-amber-500/70 tracking-wider mb-1">FAILED COMMS (24H)</div>
                  {(threatQuery.data?.topFailures?.length ?? 0) === 0 ? (
                    <div className="text-[10px] font-mono text-emerald-400">✓ ZERO TRANSMISSION FAILURES</div>
                  ) : threatQuery.data?.topFailures.map(([fn, info]) => (
                    <div key={fn} className="text-[10px] font-mono text-red-400">⚠ {fn} — {info.count} failures</div>
                  ))}
                </div>
                {/* D3: License Expirations */}
                <div>
                  <div className="text-[9px] font-mono text-amber-500/70 tracking-wider mb-1">LICENSE EXPIRATIONS (14D)</div>
                  {(threatQuery.data?.licenses?.length ?? 0) === 0 ? (
                    <div className="text-[10px] font-mono text-emerald-400">✓ NO EXPIRATIONS THIS FORTNIGHT</div>
                  ) : (threatQuery.data?.licenses || []).map((l: any, i: number) => {
                    const days = Math.ceil((new Date(l.expiry_date).getTime() - Date.now()) / 86400000);
                    return <div key={i} className="text-[10px] font-mono text-amber-400">⚡ {l.license_name} expires in {days}d</div>;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ BOTTOM ROW: F + G ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ═══════ SECTOR F — DWA REVENUE PANELS ═══════ */}
          <div className="lg:col-span-2 space-y-3">
            <SectorHeader updatedAt={revenueQuery.dataUpdatedAt}>💰 DWA REVENUE PANELS</SectorHeader>
            {revenueQuery.isError ? <SensorOffline onRetry={() => revenueQuery.refetch()} /> : (
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                {/* Contractor Leads */}
                <RevCard title="🏗 CONTRACTOR LEADS" stats={[
                  { label: "ACTIVE CLIENTS", value: revenueQuery.data?.contractor.active ?? "—" },
                  { label: "LEADS THIS MONTH", value: revenueQuery.data?.contractor.leads ?? "—" },
                  { label: "REVENUE THIS MONTH", value: `$${(revenueQuery.data?.contractor.revenue ?? 0).toLocaleString()}` },
                ]} />
                {/* TechAlert */}
                <RevCard title="⚡ TECHALERT" stats={[
                  { label: "PAID CLIENTS", value: revenueQuery.data?.techAlert.paid ?? "—" },
                  { label: "ACTIVE TRIALS", value: revenueQuery.data?.techAlert.trials ?? "—" },
                  { label: "CANDIDATES (7D)", value: revenueQuery.data?.techAlert.candidates7d ?? "—" },
                  { label: "HOT (SCORE ≥8)", value: revenueQuery.data?.techAlert.hot ?? "—" },
                ]} />
                {/* FieldDesk */}
                <RevCard title="🔧 FIELDDESK" stats={[
                  { label: "ACTIVE CLIENTS", value: revenueQuery.data?.fieldDesk.active ?? "—" },
                  { label: "JOBS TODAY", value: revenueQuery.data?.fieldDesk.today ?? "—" },
                  { label: "COMPLETED (7D)", value: revenueQuery.data?.fieldDesk.completed7d ?? "—" },
                ]} />
              </div>
            )}
          </div>

          {/* ═══════ SECTOR G — PIPELINE FUNNELS ═══════ */}
          <div className="lg:col-span-3 space-y-3">
            <SectorHeader updatedAt={chartQuery.dataUpdatedAt}>📡 SYSTEMS INTELLIGENCE</SectorHeader>
            <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-xl p-4">
              <div className="text-[9px] font-mono text-[#00d4ff]/50 tracking-wider mb-3">📊 TRANSMISSION VOLUME — 24H</div>
              {chartQuery.isError ? <SensorOffline onRetry={() => chartQuery.refetch()} /> : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartQuery.data || []} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00d4ff11" />
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#ffffff40", fontFamily: "monospace" }} axisLine={{ stroke: "#00d4ff20" }} />
                      <YAxis tick={{ fontSize: 9, fill: "#ffffff40", fontFamily: "monospace" }} axisLine={{ stroke: "#00d4ff20" }} />
                      <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, fontSize: 11, fontFamily: "monospace" }} />
                      <Bar dataKey="sms" fill="#00d4ff" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="email" fill="#7c3aed" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* AI Model Selector */}
            <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-xl p-4">
              <div className="text-[9px] font-mono text-[#00d4ff]/50 tracking-wider mb-3">🧠 AI MODEL SELECTOR</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AI_TASK_TYPES.map(task => (
                  <div key={task.key} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/40 w-20 flex-shrink-0">{task.label}</span>
                    <Select value={getModel(task.key)} onValueChange={v => setModel(task.key, v)}>
                      <SelectTrigger className="h-6 text-[10px] bg-transparent border-[#00d4ff]/20 text-[#00d4ff] font-mono flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a1628] border-[#00d4ff]/20">
                        {AI_MODELS.map(m => (
                          <SelectItem key={m.id} value={m.id} className="text-[10px] font-mono text-[#00d4ff]">
                            {m.label} — {m.desc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KPI({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="flex flex-col items-center min-w-[80px]">
      <span className="text-[9px] font-mono text-[#00d4ff]/50 tracking-[0.15em] uppercase">{label}</span>
      <span className={`text-xl md:text-2xl font-mono font-bold ${alert ? "text-[#ef4444]" : "text-[#00d4ff]"}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <span className="text-[#00d4ff]/20 text-lg hidden md:block">│</span>;
}

function RevCard({ title, stats }: { title: string; stats: { label: string; value: string | number }[] }) {
  return (
    <div className="border border-[#00d4ff]/10 bg-gradient-to-br from-[#030711] to-[#0a1628] rounded-xl p-4">
      <div className="text-[10px] font-mono text-[#00d4ff]/70 tracking-wider mb-3">{title}</div>
      <div className="space-y-2">
        {stats.map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-white/40 tracking-widest uppercase">{s.label}</span>
            <span className="text-lg font-mono font-bold text-[#00d4ff]">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
