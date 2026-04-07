import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  Dumbbell,
  Wrench,
  Activity,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  MessageSquare,
  Phone,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string;
  phone_number: string;
  business_route: "Training" | "Web_Dev" | "Uncategorized";
  status: "New" | "Handled";
  created_at: string;
};

type Message = {
  id: string;
  lead_id: string;
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
};

type Tab = "Training" | "Web_Dev" | "Diagnostics";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isHandled = status === "Handled";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
        isHandled
          ? "bg-green-500/20 text-green-400"
          : "bg-amber-500/20 text-amber-400"
      }`}
    >
      {isHandled ? <CheckCircle2 size={9} /> : <MessageSquare size={9} />}
      {isHandled ? "Handled" : "New"}
    </span>
  );
}

function RouteBadge({ route }: { route: string }) {
  const cfg =
    route === "Training"
      ? { label: "Training", cls: "bg-blue-500/20 text-blue-400" }
      : route === "Web_Dev"
      ? { label: "Web Dev", cls: "bg-orange-500/20 text-[#e8621a]" }
      : { label: "Uncategorized", cls: "bg-slate-500/20 text-slate-400" };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Inbox Panel ──────────────────────────────────────────────────────────────

function InboxPanel({
  leads,
  activeLead,
  onSelectLead,
  isLoading,
}: {
  leads: Lead[];
  activeLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-[#e8621a]" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500 px-6 text-center">
        <MessageSquare size={32} strokeWidth={1} />
        <p className="text-sm">No leads yet.</p>
        <p className="text-xs">Use the Diagnostics tab to simulate an inbound SMS.</p>
      </div>
    );
  }

  return (
    <ul className="overflow-y-auto h-full divide-y divide-slate-700/50">
      {leads.map((lead) => (
        <li key={lead.id}>
          <button
            onClick={() => onSelectLead(lead)}
            className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-slate-800/60 focus:outline-none ${
              activeLead?.id === lead.id
                ? "border-l-2 border-[#e8621a] bg-slate-800/40"
                : "border-l-2 border-transparent"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-slate-100">
                {formatPhone(lead.phone_number)}
              </span>
              <StatusBadge status={lead.status} />
            </div>
            <p className="text-xs text-slate-400 truncate mb-1.5">
              {lead.business_route === "Training"
                ? "M² Training inquiry"
                : lead.business_route === "Web_Dev"
                ? "Motor City Machine Dev inquiry"
                : "Uncategorized inquiry"}
            </p>
            <span className="text-[10px] text-slate-500">
              {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({
  lead,
  messages,
  onBack,
  onMarkHandled,
  isHandling,
  replyText,
  onReplyChange,
  onSend,
  isSending,
  webhookUrl,
}: {
  lead: Lead | null;
  messages: Message[];
  onBack: () => void;
  onMarkHandled: (id: string) => void;
  isHandling: boolean;
  replyText: string;
  onReplyChange: (val: string) => void;
  onSend: () => void;
  isSending: boolean;
  webhookUrl: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!lead) {
    return (
      <div className="hidden md:flex flex-col items-center justify-center h-full gap-3 text-slate-600">
        <Phone size={36} strokeWidth={1} />
        <p className="text-sm">Select a lead to view the conversation</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <button
          onClick={onBack}
          className="md:hidden flex items-center gap-1 text-slate-400 hover:text-white transition-colors mr-1"
        >
          <ArrowLeft size={18} />
          <span className="text-xs font-semibold uppercase tracking-wide">Back</span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base font-bold text-white">
              {formatPhone(lead.phone_number)}
            </span>
            <RouteBadge route={lead.business_route} />
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Lead received {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
          </p>
        </div>
        <button
          onClick={() => onMarkHandled(lead.id)}
          disabled={isHandling || lead.status === "Handled"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${
            lead.status === "Handled"
              ? "bg-green-500/20 text-green-400 cursor-default"
              : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
          }`}
        >
          {isHandling ? (
            <Loader2 size={12} className="animate-spin" />
          ) : lead.status === "Handled" ? (
            <CheckCircle2 size={12} />
          ) : (
            <CheckCircle2 size={12} />
          )}
          {lead.status === "Handled" ? "Handled" : "Mark Handled"}
        </button>
      </div>

      {/* Bubbles */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-slate-600 text-xs pt-8">
            No messages yet — simulate one from the Diagnostics tab.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.direction === "outbound"
                  ? "bg-[#e8621a] text-white rounded-br-sm"
                  : "bg-slate-800 text-slate-200 rounded-bl-sm"
              }`}
            >
              <p>{msg.body}</p>
              <p
                className={`text-[10px] mt-1 ${
                  msg.direction === "outbound" ? "text-orange-200/70" : "text-slate-500"
                }`}
              >
                {format(new Date(msg.created_at), "HH:mm")}
                {msg.id.startsWith("opt-") && (
                  <span className="ml-1 italic">· sending…</span>
                )}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-700 bg-slate-900/80 backdrop-blur-sm shrink-0">
        {!webhookUrl && (
          <p className="text-[11px] text-amber-400 mb-2 px-1">
            ⚠ Set your n8n webhook URL in Diagnostics to enable sending.
          </p>
        )}
        <div className="flex gap-2">
          <textarea
            value={replyText}
            onChange={(e) => onReplyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={webhookUrl ? "Type a message… (Enter to send)" : "Configure webhook to send"}
            disabled={!webhookUrl}
            rows={2}
            className="flex-1 min-h-[48px] resize-none rounded-xl bg-slate-800 border border-slate-600 text-sm text-slate-100 placeholder:text-slate-500 px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#e8621a] disabled:opacity-40"
          />
          <button
            onClick={onSend}
            disabled={!replyText.trim() || !webhookUrl || isSending}
            className="min-h-[48px] min-w-[56px] flex items-center justify-center rounded-xl bg-[#e8621a] text-white font-bold disabled:opacity-40 hover:bg-[#d4571a] transition-colors"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Diagnostics Panel ────────────────────────────────────────────────────────

function DiagnosticsPanel({
  onRefreshLeads,
}: {
  onRefreshLeads: () => void;
}) {
  const [tdlcApproved, setTdlcApproved] = useState(
    () => localStorage.getItem("tdlc_approved") === "true"
  );
  const [webhookUrl, setWebhookUrl] = useState(
    () => localStorage.getItem("n8n_webhook_url") || ""
  );
  const [urlDraft, setUrlDraft] = useState(
    () => localStorage.getItem("n8n_webhook_url") || ""
  );
  const [mockMsg, setMockMsg] = useState(
    "I need a new website for my auto repair shop"
  );
  const [mockFrom, setMockFrom] = useState("+13135550000");
  const [simStatus, setSimStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [simResponse, setSimResponse] = useState("");

  const handleToggleTdlc = (checked: boolean) => {
    setTdlcApproved(checked);
    localStorage.setItem("tdlc_approved", String(checked));
  };

  const handleSaveUrl = () => {
    setWebhookUrl(urlDraft);
    localStorage.setItem("n8n_webhook_url", urlDraft);
    toast.success("Webhook URL saved");
  };

  const handleSimulate = async () => {
    if (!webhookUrl) {
      toast.error("Save your n8n webhook URL first");
      return;
    }
    setSimStatus("loading");
    setSimResponse("");
    const payload = {
      body: {
        ToCountry: "US",
        ToState: "MI",
        SmsMessageSid: `SM_TEST_${Date.now()}`,
        NumMedia: "0",
        ToCity: "DETROIT",
        FromZip: "48230",
        SmsStatus: "received",
        FromCity: "GROSSE POINTE",
        Body: mockMsg,
        From: mockFrom,
        To: "+13139921219",
        FromCountry: "US",
        NumSegments: "1",
      },
    };
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const status = `HTTP ${res.status} ${res.statusText}`;
      setSimResponse(status);
      setSimStatus(res.ok ? "success" : "error");
      if (res.ok) {
        setTimeout(() => onRefreshLeads(), 2500);
        toast.success("Payload sent — leads will refresh in 3s");
      }
    } catch (err: any) {
      setSimStatus("error");
      setSimResponse(err.message || "Network error");
      toast.error("Failed to reach n8n webhook");
    }
  };

  return (
    <div className="overflow-y-auto h-full px-4 py-5 space-y-5">
      {/* A2P 10DLC card */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} className="text-purple-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-200">
            Twilio A2P 10DLC Status
          </h3>
        </div>

        {tdlcApproved ? (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
            <Wifi size={14} className="text-green-400 shrink-0" />
            <span className="text-xs font-semibold text-green-400">
              Carrier Approved — SMS delivery is active.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <span className="text-xs text-amber-300">
              <strong>Carrier filtering may be active.</strong> 10DLC approval is pending.
              Check <span className="font-mono">Twilio Console → Messaging → Regulatory Compliance</span>.
            </span>
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={tdlcApproved}
            onChange={(e) => handleToggleTdlc(e.target.checked)}
            className="w-4 h-4 accent-[#e8621a] cursor-pointer"
          />
          <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
            I've confirmed 10DLC is approved in Twilio Console
          </span>
        </label>
      </div>

      {/* n8n Webhook tester */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-[#e8621a]" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-200">
            n8n Webhook Tester
          </h3>
        </div>

        {/* URL input */}
        <div className="mb-4">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            n8n Webhook URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://your-n8n.app/webhook/..."
              className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#e8621a]"
            />
            <button
              onClick={handleSaveUrl}
              className="px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors"
            >
              Save
            </button>
          </div>
          {webhookUrl && (
            <p className="text-[10px] text-green-400 mt-1.5 flex items-center gap-1">
              <CheckCircle2 size={10} /> URL saved
            </p>
          )}
        </div>

        {/* Mock From */}
        <div className="mb-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            Simulated "From" Phone
          </label>
          <input
            type="tel"
            value={mockFrom}
            onChange={(e) => setMockFrom(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-[#e8621a]"
          />
        </div>

        {/* Mock message */}
        <div className="mb-4">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            Mock SMS Body
          </label>
          <textarea
            value={mockMsg}
            onChange={(e) => setMockMsg(e.target.value)}
            rows={3}
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-[#e8621a]"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Tip: include "website" or "design" to route to Web Dev; "training" or "workout" to route to M² Training.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSimulate}
            disabled={simStatus === "loading" || !webhookUrl}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e8621a] text-white font-bold text-xs uppercase tracking-widest hover:bg-[#d4571a] disabled:opacity-50 transition-colors"
          >
            {simStatus === "loading" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Zap size={13} />
            )}
            Simulate Inbound SMS
          </button>

          <button
            onClick={() => { onRefreshLeads(); toast.success("Leads refreshed"); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors"
          >
            <RefreshCw size={13} />
            Refresh Leads
          </button>
        </div>

        {/* Status chip */}
        {simStatus !== "idle" && (
          <div
            className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono ${
              simStatus === "success"
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : simStatus === "error"
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "bg-slate-700 text-slate-400"
            }`}
          >
            {simStatus === "success" ? (
              <Wifi size={12} />
            ) : simStatus === "error" ? (
              <WifiOff size={12} />
            ) : (
              <Loader2 size={12} className="animate-spin" />
            )}
            {simResponse || "Sending…"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

function BottomNav({
  activeTab,
  onTabChange,
  trainingNew,
  webDevNew,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  trainingNew: number;
  webDevNew: number;
}) {
  const tabs: { key: Tab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key: "Training", icon: <Dumbbell size={20} />, label: "Training", badge: trainingNew },
    { key: "Web_Dev", icon: <Wrench size={20} />, label: "Dev", badge: webDevNew },
    { key: "Diagnostics", icon: <Activity size={20} />, label: "Diagnostics" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-700 flex">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        const accentColor =
          tab.key === "Training"
            ? "text-blue-400"
            : tab.key === "Web_Dev"
            ? "text-[#e8621a]"
            : "text-purple-400";
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative ${
              active ? accentColor : "text-slate-500"
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute top-2 right-[calc(50%-14px)] min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Left Icon Rail (md+) ─────────────────────────────────────────────────────

function LeftIconRail({
  activeTab,
  onTabChange,
  trainingNew,
  webDevNew,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  trainingNew: number;
  webDevNew: number;
}) {
  const tabs: { key: Tab; icon: React.ReactNode; badge?: number }[] = [
    { key: "Training", icon: <Dumbbell size={22} />, badge: trainingNew },
    { key: "Web_Dev", icon: <Wrench size={22} />, badge: webDevNew },
    { key: "Diagnostics", icon: <Activity size={22} /> },
  ];

  return (
    <aside className="hidden md:flex flex-col items-center py-4 gap-2 w-16 bg-slate-900/90 border-r border-slate-700 shrink-0">
      <div className="mb-4 text-[#e8621a]">
        <MessageSquare size={22} />
      </div>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        const accentColor =
          tab.key === "Training"
            ? "text-blue-400 bg-blue-500/10"
            : tab.key === "Web_Dev"
            ? "text-[#e8621a] bg-orange-500/10"
            : "text-purple-400 bg-purple-500/10";
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            title={tab.key === "Web_Dev" ? "Motor City Machine Dev" : tab.key}
            className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
              active ? accentColor : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            }`}
          >
            {tab.icon}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommunicationsCenter() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("Training");
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<"inbox" | "chat">("inbox");
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  const webhookUrl = localStorage.getItem("n8n_webhook_url") || "";

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["comms-leads"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Lead[];
    },
  });

  const { data: dbMessages = [] } = useQuery({
    queryKey: ["comms-messages", activeLead?.id],
    queryFn: async () => {
      if (!activeLead) return [];
      const { data, error } = await (supabase as any)
        .from("messages")
        .select("*")
        .eq("lead_id", activeLead.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!activeLead,
  });

  const allMessages: Message[] = [
    ...dbMessages,
    ...optimisticMessages.filter((m) => m.lead_id === activeLead?.id),
  ];

  // ── Mutations ──────────────────────────────────────────────────────────────

  const handleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("leads")
        .update({ status: "Handled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comms-leads"] });
      toast.success("Marked as handled");
    },
    onError: (err: Error) =>
      toast.error("Failed to update: " + err.message),
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredLeads = leads.filter((l) =>
    activeTab === "Diagnostics" ? false : l.business_route === activeTab
  );

  const trainingNew = leads.filter(
    (l) => l.business_route === "Training" && l.status === "New"
  ).length;
  const webDevNew = leads.filter(
    (l) => l.business_route === "Web_Dev" && l.status === "New"
  ).length;

  // Keep activeLead in sync when leads refresh
  useEffect(() => {
    if (activeLead) {
      const fresh = leads.find((l) => l.id === activeLead.id);
      if (fresh) setActiveLead(fresh);
    }
  }, [leads]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectLead = (lead: Lead) => {
    setActiveLead(lead);
    setMobileViewMode("chat");
    setOptimisticMessages((prev) => prev.filter((m) => m.lead_id !== lead.id));
  };

  const handleBack = () => {
    setMobileViewMode("inbox");
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setMobileViewMode("inbox");
    if (tab === "Diagnostics") setActiveLead(null);
  };

  const handleSend = async () => {
    if (!activeLead || !replyText.trim() || !webhookUrl) return;
    const text = replyText.trim();
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      lead_id: activeLead.id,
      direction: "outbound",
      body: text,
      created_at: new Date().toISOString(),
    };
    setOptimisticMessages((prev) => [...prev, optimistic]);
    setReplyText("");
    setIsSending(true);
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: activeLead.phone_number, message: text }),
      });
    } catch {
      // n8n handles the Twilio send; don't surface network errors here
    } finally {
      setIsSending(false);
      setTimeout(
        () => queryClient.invalidateQueries({ queryKey: ["comms-messages", activeLead.id] }),
        2000
      );
    }
  };

  const handleRefreshLeads = () => {
    queryClient.invalidateQueries({ queryKey: ["comms-leads"] });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#0f172a] text-white overflow-hidden">
      {/* Left icon rail — md+ only */}
      <LeftIconRail
        activeTab={activeTab}
        onTabChange={handleTabChange}
        trainingNew={trainingNew}
        webDevNew={webDevNew}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {activeTab === "Diagnostics" ? (
          /* ─ Diagnostics replaces inbox+chat ─ */
          <div className="flex-1 overflow-hidden">
            {/* Mobile top bar */}
            <div className="md:hidden flex items-center gap-2 px-4 py-3.5 border-b border-slate-700 bg-slate-900/80 shrink-0">
              <Activity size={16} className="text-purple-400" />
              <span className="text-sm font-bold uppercase tracking-widest text-slate-200">
                Integration Health
              </span>
            </div>
            {/* Desktop header */}
            <div className="hidden md:flex items-center gap-2 px-5 py-4 border-b border-slate-700">
              <Activity size={16} className="text-purple-400" />
              <span className="text-base font-bold text-slate-200">Integration Health</span>
            </div>
            <DiagnosticsPanel onRefreshLeads={handleRefreshLeads} />
          </div>
        ) : (
          <>
            {/* ─ Inbox column ─ */}
            <div
              className={`
                absolute inset-0 md:static md:w-[35%] md:border-r md:border-slate-700
                flex flex-col bg-[#0f172a] transition-transform duration-300 ease-in-out
                ${mobileViewMode === "chat" ? "-translate-x-full" : "translate-x-0"}
                md:translate-x-0
              `}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-700 bg-slate-900/80 shrink-0">
                <div className="flex items-center gap-2">
                  {activeTab === "Training" ? (
                    <Dumbbell size={15} className="text-blue-400" />
                  ) : (
                    <Wrench size={15} className="text-[#e8621a]" />
                  )}
                  <span className="text-sm font-bold uppercase tracking-widest text-slate-200">
                    {activeTab === "Training" ? "M² Training" : "Motor City Machine Dev"}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Lead list */}
              <div className="flex-1 overflow-hidden">
                <InboxPanel
                  leads={filteredLeads}
                  activeLead={activeLead}
                  onSelectLead={handleSelectLead}
                  isLoading={isLoading}
                />
              </div>
            </div>

            {/* ─ Chat column ─ */}
            <div
              className={`
                absolute inset-0 md:static md:flex-1
                flex flex-col bg-[#0f172a] transition-transform duration-300 ease-in-out
                ${mobileViewMode === "chat" ? "translate-x-0" : "translate-x-full"}
                md:translate-x-0
              `}
            >
              <ChatPanel
                lead={activeLead}
                messages={allMessages}
                onBack={handleBack}
                onMarkHandled={(id) => handleMutation.mutate(id)}
                isHandling={handleMutation.isPending}
                replyText={replyText}
                onReplyChange={setReplyText}
                onSend={handleSend}
                isSending={isSending}
                webhookUrl={webhookUrl}
              />
            </div>
          </>
        )}
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        trainingNew={trainingNew}
        webDevNew={webDevNew}
      />

      {/* Spacer for bottom nav on mobile */}
      <div className="md:hidden fixed bottom-0 inset-x-0 h-16 pointer-events-none" />
    </div>
  );
}
