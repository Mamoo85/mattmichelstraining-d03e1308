// Two-way SMS inbox for the DWA work number (+13139921219).
// Reads inbound + outbound from system_comms_log, groups by phone number,
// shows full conversation threads, and lets you reply via dwa-send-sms.
//
// Identifies which product each contact relates to by cross-referencing
// their phone against contractor_clients, field_crm_clients, hire_alert_clients.

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ResendSmsModal, { type ResendTarget } from "./ResendSmsModal";

type CommsRow = {
  id: string;
  channel: string;
  product: string | null;
  recipient: string | null;
  body_preview: string | null;
  body_full: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Direction = "inbound" | "outbound";

type Message = {
  id: string;
  direction: Direction;
  body: string;          // body_full ?? body_preview — what we render
  body_full: string | null; // raw, for resend
  status: string;
  product: string | null;
  created_at: string;
};

type Thread = {
  phone: string; // E.164
  display: string; // formatted
  lastMessage: Message;
  unreadCount: number;
  contactLabel?: string; // e.g. "Premier Plumbing Co (contractor)"
  messages: Message[];
};

// ----- helpers -----

function normalize(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+1\d{10}$/.test(digits)) return digits;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  // Display-format like "(313) 555-1234" → already covered by digit strip
  if (/^\d{11}$/.test(digits)) return `+${digits}`;
  return null;
}

function formatPhone(e164: string): string {
  if (/^\+1\d{10}$/.test(e164)) {
    const a = e164.slice(2, 5);
    const b = e164.slice(5, 8);
    const c = e164.slice(8, 12);
    return `(${a}) ${b}-${c}`;
  }
  return e164;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// ----- component -----

// Onboarding cheatsheet — shown when an unknown phone is selected. Each entry
// can be one-click copied into the reply box and personalized before sending.
const ONBOARDING_FAQ: Array<{ q: string; a: string }> = [
  {
    q: "How are leads generated?",
    a: "Homeowners in your trade + city request quotes on detroitwebagent.com. You get an instant SMS with their name, number, and job details — no shared leads, just yours.",
  },
  {
    q: "How much / what's the price?",
    a: "$399/mo flat. One contractor per trade per city — exclusive territory. No per-lead fees, no contracts, cancel anytime.",
  },
  {
    q: "What if a lead is bad?",
    a: "If a lead is fake or unreachable, just text me and I'll credit it on your next bill. I want this to work for you long-term.",
  },
  {
    q: "Can I cancel?",
    a: "Yep — cancel anytime, no contracts. Just text or email me and I'll shut it off the same day.",
  },
  {
    q: "Multiple cities / territories?",
    a: "Sure — each city is a separate $399/mo territory. Most guys start with one and add more once leads are flowing.",
  },
  {
    q: "Exclusivity proof?",
    a: "Only one contractor per trade per city. I'll never sell your zip to another HVAC/plumber/etc — that's the whole point.",
  },
  {
    q: "Average leads/month?",
    a: "Depends on city + trade, but Metro Detroit roofers/HVAC see 8–20/mo on average. I'll be straight with you about volume in your area.",
  },
  {
    q: "How do I get notified?",
    a: "Instant SMS to your cell the second a lead comes in — usually before they even submit on a competitor's site. Speed wins.",
  },
  {
    q: "🔥 Full pitch (long-form reply)",
    a: "Sorry for the delay — here's exactly how it works:\n\nHow leads come in: Homeowners fill out a quote form on detroitwebagent.com (we run Google/Facebook ads + SEO to drive them). When one matches your trade + city, you get an instant SMS with their name, phone, address, and job details. First to call usually wins — most of my contractors call within 5 minutes.\n\nLeads per month: Honestly varies by trade and city — plumbing/HVAC in Metro Detroit is pulling 8–15/mo per territory right now. Roofing spikes after storms (20+). I don't promise a number because I won't BS you — but if you don't get at least 5 in your first month I'll refund you, no questions.\n\nConfirmed real leads: Yes — every lead is a real homeowner who filled out the form themselves. No scraped lists, no shared leads, no bots. You're the only contractor who gets it (one contractor per trade per city — that's the whole point of the territory lock).\n\nMultiple territories: Absolutely — $399/mo per trade per city. Most guys start with 1 city to test, then add neighbors (Warren, Sterling Heights, Roseville, etc.) once they see leads come in. No contract, cancel anytime.\n\nWant me to lock in your trade + first city right now? Just tell me the trade and which city you want to start with.\n\n— Matt | (313) 992-1219",
  },
  {
    q: "Are these real leads or scraped?",
    a: "Real homeowners who filled out the quote form themselves on detroitwebagent.com. No scraped lists, no shared leads, no bots. You're the only contractor in your trade + city who gets them.",
  },
  {
    q: "Refund / guarantee?",
    a: "If you don't get at least 5 real leads in your first month, I'll refund you in full — no questions. I want this to actually work for you.",
  },
  {
    q: "Speed-to-call matters",
    a: "First contractor to call almost always wins the job. Most of my guys call within 5 minutes of the SMS — that's why we send the alert instantly instead of an email digest.",
  },
];

export default function AdminSMSInbox() {
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [resendTarget, setResendTarget] = useState<ResendTarget | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mobile: when a thread is picked, hide the list. Back button returns to list.
  const showListOnMobile = !activePhone && !composing;
  const showConvoOnMobile = !!activePhone || composing;

  async function loadInbox() {
    setLoading(true);
    try {
      // Pull last 30 days of SMS
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("system_comms_log")
        .select("id, channel, product, recipient, body_preview, body_full, status, metadata, created_at")
        .eq("channel", "sms")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(2000);

      if (error) throw error;
      const rows = (data ?? []) as CommsRow[];

      // Build threads keyed by counterparty phone
      const map = new Map<string, Message[]>();

      for (const r of rows) {
        let counterparty: string | null = null;
        let direction: Direction = "outbound";
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        const metaFrom = typeof meta.from === "string" ? meta.from : null;
        const metaDir = typeof meta.direction === "string" ? meta.direction : null;

        if (r.status === "inbound" || metaDir === "inbound" || r.product === "inbound") {
          // Inbound: counterparty is sender (metadata.from)
          direction = "inbound";
          counterparty = normalize(metaFrom);
        } else {
          // Outbound: counterparty is recipient
          direction = "outbound";
          counterparty = normalize(r.recipient);
        }

        if (!counterparty) continue;
        // Skip messages to/from Matt's personal cell — those are admin-relay noise
        if (counterparty === "+13138064952") continue;

        const arr = map.get(counterparty) ?? [];
        arr.push({
          id: r.id,
          direction,
          body: r.body_full ?? r.body_preview ?? "",
          body_full: r.body_full,
          status: r.status ?? "",
          product: r.product,
          created_at: r.created_at,
        });
        map.set(counterparty, arr);
      }

      // Lookup product/contact context for each phone
      const phones = Array.from(map.keys());
      const labelMap = await fetchContactLabels(phones);

      const built: Thread[] = phones.map((phone) => {
        const messages = map.get(phone)!;
        const last = messages[messages.length - 1];
        const unreadCount = messages.filter(
          (m) => m.direction === "inbound" && !readSet().has(m.id)
        ).length;
        return {
          phone,
          display: formatPhone(phone),
          lastMessage: last,
          unreadCount,
          contactLabel: labelMap.get(phone),
          messages,
        };
      });

      // Sort by last message desc
      built.sort(
        (a, b) =>
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime()
      );

      setThreads(built);
      // Default to first thread on desktop only — mobile keeps list visible
      if (!activePhone && !composing && built.length > 0 && window.innerWidth >= 768) {
        setActivePhone(built[0].phone);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  // Cross-reference phones against client tables to label threads
  async function fetchContactLabels(phones: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (phones.length === 0) return out;

    // Build a digits-only set for matching (some tables store formatted)
    const digitsToE164 = new Map<string, string>();
    for (const p of phones) {
      const d = p.replace(/\D/g, "");
      digitsToE164.set(d, p);
      if (d.length === 11 && d.startsWith("1")) digitsToE164.set(d.slice(1), p);
    }

    const lookups: Array<{ table: "contractor_clients" | "field_crm_clients"; label: string; field: string }> = [
      { table: "contractor_clients", label: "contractor", field: "business_name" },
      { table: "field_crm_clients", label: "FieldDesk", field: "business_name" },
    ];

    await Promise.all(
      lookups.map(async (lk) => {
        try {
          const { data } = await supabase
            .from(lk.table)
            .select(`${lk.field}, phone`)
            .not("phone", "is", null)
            .limit(2000);
          const rows = (data ?? []) as unknown as Array<Record<string, string | null>>;
          for (const row of rows) {
            const p = row.phone ? row.phone.replace(/\D/g, "") : "";
            const matched = digitsToE164.get(p) || digitsToE164.get(p.replace(/^1/, ""));
            if (matched && !out.has(matched)) {
              out.set(matched, `${row[lk.field] ?? "Unknown"} (${lk.label})`);
            }
          }
        } catch {
          /* silent — best-effort labeling */
        }
      })
    );

    return out;
  }

  // Local "read" tracking via localStorage (no DB column needed yet)
  function readSet(): Set<string> {
    try {
      const raw = localStorage.getItem("dwa_sms_read") ?? "[]";
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  }
  function markThreadRead(thread: Thread) {
    const set = readSet();
    let changed = false;
    for (const m of thread.messages) {
      if (m.direction === "inbound" && !set.has(m.id)) {
        set.add(m.id);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem("dwa_sms_read", JSON.stringify(Array.from(set)));
      // Recompute unread count for this thread without a full reload
      setThreads((prev) =>
        prev.map((t) => (t.phone === thread.phone ? { ...t, unreadCount: 0 } : t))
      );
    }
  }

  useEffect(() => {
    loadInbox();
    // Realtime: any new SMS row → refresh
    const ch = supabase
      .channel("admin-sms-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "system_comms_log", filter: "channel=eq.sms" },
        () => loadInbox()
      )
      .subscribe();
    // Poll every 20s as a safety net in case realtime drops
    const poll = setInterval(loadInbox, 20_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark active thread as read + autoscroll on change
  useEffect(() => {
    const t = threads.find((x) => x.phone === activePhone);
    if (t) markThreadRead(t);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhone, threads.length]);

  const activeThread = useMemo(
    () => threads.find((t) => t.phone === activePhone) ?? null,
    [threads, activePhone]
  );

  const totalUnread = useMemo(
    () => threads.reduce((n, t) => n + t.unreadCount, 0),
    [threads]
  );

  async function handleSend() {
    const targetPhone = composing ? normalize(composeTo) : activeThread?.phone ?? null;
    if (!targetPhone) {
      toast.error(composing ? "Enter a valid US phone number" : "No recipient");
      return;
    }
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("dwa-send-sms", {
        body: { to: targetPhone, body: draft.trim() },
      });
      if (error) throw error;
      const result = data as { success?: boolean; skipped?: boolean; error?: string };
      if (!result?.success) {
        toast.error(result?.skipped ? `Skipped: ${result.error}` : result?.error ?? "Send failed");
        return;
      }
      toast.success("Sent");
      setDraft("");
      // If we were composing, switch to the new thread
      if (composing) {
        setComposing(false);
        setComposeTo("");
        setActivePhone(targetPhone);
      }
      await loadInbox();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  function startCompose() {
    setComposing(true);
    setActivePhone(null);
    setDraft("");
    setComposeTo("");
  }

  async function handleAIDraft() {
    const targetPhone = composing ? normalize(composeTo) : activeThread?.phone ?? null;
    if (!targetPhone) {
      toast.error("Pick a thread or enter a number first");
      return;
    }
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-sms-reply", {
        body: { phone: targetPhone, hint: draft.trim() || undefined },
      });
      if (error) throw error;
      const result = data as { draft?: string; error?: string };
      if (!result?.draft) {
        toast.error(result?.error ?? "No draft returned");
        return;
      }
      setDraft(result.draft);
      toast.success("Draft ready — edit or send");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  const composeNormalized = composing ? normalize(composeTo) : null;
  const composeValid = composing ? composeNormalized !== null : true;

  // Show the onboarding cheatsheet for any unknown contact (no contractor/FieldDesk label)
  const isUnknownContact = activeThread && !activeThread.contactLabel;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-white">💬 SMS Inbox</h2>
          <p className="text-white/50 text-[11px] sm:text-xs">
            (313) 992-1219 · last 30 days
            {totalUnread > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded bg-[#00d4ff]/20 text-[#00d4ff] text-[10px] font-semibold">
                {totalUnread} unread
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startCompose}
            className="px-3 py-1.5 rounded text-xs font-bold bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90"
          >
            ✏️ New
          </button>
          <button
            onClick={async () => {
              await loadInbox();
              toast.success("Inbox refreshed");
            }}
            disabled={loading}
            className="px-3 py-1.5 rounded text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh inbox"
          >
            <span className={loading ? "inline-block animate-spin" : "inline-block"}>↻</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-200px)] md:h-[70vh] min-h-[500px]">
        {/* Thread list — hidden on mobile when a convo/compose is open */}
        <div className={`${showListOnMobile ? "block" : "hidden"} md:block border border-white/10 rounded-lg bg-white/[0.02] overflow-y-auto`}>
          {loading && threads.length === 0 && (
            <div className="p-4 text-white/40 text-sm">Loading…</div>
          )}
          {!loading && threads.length === 0 && (
            <div className="p-4 text-white/40 text-sm">
              No SMS conversations yet. Tap <b>✏️ New</b> to text any number.
            </div>
          )}
          {threads.map((t) => {
            const active = t.phone === activePhone;
            return (
              <button
                key={t.phone}
                onClick={() => { setComposing(false); setActivePhone(t.phone); }}
                className={`w-full text-left p-3 border-b border-white/5 transition ${
                  active ? "bg-[#00d4ff]/10" : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate">
                    {t.display}
                  </span>
                  <span className="text-[10px] text-white/40 shrink-0">
                    {timeAgo(t.lastMessage.created_at)}
                  </span>
                </div>
                {t.contactLabel && (
                  <div className="text-[11px] text-[#00d4ff] truncate mt-0.5">
                    {t.contactLabel}
                  </div>
                )}
                <div className="text-xs text-white/50 truncate mt-1 flex items-center gap-2">
                  {t.lastMessage.direction === "outbound" && (
                    <span className="text-white/30 shrink-0">You:</span>
                  )}
                  <span className="truncate">{t.lastMessage.body}</span>
                </div>
                {t.unreadCount > 0 && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-[#00d4ff] text-[#0a1628] text-[10px] font-bold">
                    {t.unreadCount} new
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Conversation panel — hidden on mobile when on list */}
        <div className={`${showConvoOnMobile ? "flex" : "hidden"} md:flex border border-white/10 rounded-lg bg-white/[0.02] flex-col min-h-0`}>
          {!activeThread && !composing && (
            <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
              Select a conversation or tap ✏️ New
            </div>
          )}

          {/* COMPOSE MODE */}
          {composing && (
            <>
              <div className="px-3 py-3 border-b border-white/10 flex items-center gap-2">
                <button
                  onClick={() => { setComposing(false); setComposeTo(""); setDraft(""); }}
                  className="md:hidden text-white/70 hover:text-white text-sm px-2 py-1"
                  aria-label="Back"
                >
                  ←
                </button>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-white/50 text-xs shrink-0">To:</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoFocus
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="(313) 555-1234"
                    className="flex-1 bg-[#0a1628] border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d4ff]"
                  />
                </div>
                {composeNormalized && (
                  <span className="text-[10px] text-[#00d4ff] hidden sm:inline">
                    {formatPhone(composeNormalized)}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 text-white/40 text-sm flex items-center justify-center">
                {composeValid
                  ? "New conversation — your reply will start the thread."
                  : "Enter a 10-digit US phone number to begin."}
              </div>
              <div className="border-t border-white/10 p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type your message…"
                  rows={3}
                  className="w-full bg-[#0a1628] border border-white/10 rounded p-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d4ff]"
                  disabled={sending}
                />
                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <span className="text-[11px] text-white/40 truncate">
                    From (313) 992-1219 · {draft.length}/1500
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAIDraft}
                      disabled={drafting || !composeValid}
                      className="px-3 py-1.5 rounded font-semibold text-xs bg-white/5 hover:bg-white/10 text-white border border-white/10 disabled:opacity-40 shrink-0"
                      title="Generate an AI-suggested reply"
                    >
                      {drafting ? "Drafting…" : "🤖 Draft"}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sending || !draft.trim() || !composeValid}
                      className="px-4 py-1.5 rounded font-bold text-sm bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      {sending ? "Sending…" : "Send →"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* EXISTING THREAD MODE */}
          {activeThread && !composing && (
            <>
              <div className="px-3 sm:px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => setActivePhone(null)}
                    className="md:hidden text-white/70 hover:text-white text-lg px-1"
                    aria-label="Back to inbox"
                  >
                    ←
                  </button>
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">{activeThread.display}</div>
                    {activeThread.contactLabel && (
                      <div className="text-[#00d4ff] text-xs truncate">{activeThread.contactLabel}</div>
                    )}
                  </div>
                </div>
                <a
                  href={`tel:${activeThread.phone}`}
                  className="text-xs text-white/60 hover:text-white px-3 py-1.5 rounded border border-white/10 shrink-0"
                >
                  📞 Call
                </a>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
                {activeThread.messages.map((m) => {
                  const mine = m.direction === "outbound";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                          mine
                            ? "bg-[#00d4ff] text-[#0a1628]"
                            : "bg-white/[0.06] text-white border border-white/10"
                        }`}
                      >
                        <div>{m.body}</div>
                        <div
                          className={`text-[10px] mt-1 ${
                            mine ? "text-[#0a1628]/60" : "text-white/40"
                          }`}
                        >
                          {new Date(m.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          {m.product && ` · ${m.product}`}
                          {m.status && m.status !== "sent" && m.status !== "inbound" && ` · ${m.status}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Onboarding cheatsheet — only visible when contact is unknown (likely new prospect) */}
              {isUnknownContact && (
                <div className="border-t border-white/10 bg-white/[0.02]">
                  <button
                    onClick={() => setShowCheatsheet((s) => !s)}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-[#00d4ff] hover:bg-white/[0.03] flex items-center justify-between"
                  >
                    <span>📋 Onboarding cheatsheet — tap an answer to load it</span>
                    <span className="text-white/40">{showCheatsheet ? "▾" : "▸"}</span>
                  </button>
                  {showCheatsheet && (
                    <div className="px-3 pb-3 space-y-1.5 max-h-56 overflow-y-auto">
                      {ONBOARDING_FAQ.map((item) => (
                        <button
                          key={item.q}
                          onClick={() => {
                            setDraft(item.a);
                            toast.success("Loaded — edit before sending");
                          }}
                          className="w-full text-left p-2 rounded bg-white/[0.03] hover:bg-white/[0.08] border border-white/5"
                        >
                          <div className="text-[11px] font-semibold text-white/80">{item.q}</div>
                          <div className="text-[11px] text-white/50 mt-0.5 line-clamp-2">{item.a}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-white/10 p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type your reply…"
                  rows={3}
                  className="w-full bg-[#0a1628] border border-white/10 rounded p-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d4ff]"
                  disabled={sending}
                />
                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <span className="text-[11px] text-white/40 truncate">
                    From (313) 992-1219 · {draft.length}/1500
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAIDraft}
                      disabled={drafting}
                      className="px-3 py-1.5 rounded font-semibold text-xs bg-white/5 hover:bg-white/10 text-white border border-white/10 disabled:opacity-40 shrink-0"
                      title="Generate an AI-suggested reply"
                    >
                      {drafting ? "Drafting…" : "🤖 Draft"}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sending || !draft.trim()}
                      className="px-4 py-1.5 rounded font-bold text-sm bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      {sending ? "Sending…" : "Send →"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
