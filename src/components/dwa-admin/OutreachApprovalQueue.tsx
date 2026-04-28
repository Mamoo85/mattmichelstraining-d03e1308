import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X, Mail, MessageSquare, Inbox, Zap } from "lucide-react";
import { toast } from "sonner";

interface QueueRow {
  id: string;
  source_function: string;
  channel: string;
  account_name: string | null;
  account_location: string | null;
  account_vertical: string | null;
  draft_subject: string | null;
  draft_body: string;
  signal_reason: string | null;
  confidence_score: number | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: string;
  created_at: string;
}

const SOURCE_LABEL: Record<string, string> = {
  "techalert-auto-pitch": "🎯 TechAlert",
  "competitor-displacement-detector": "⚔️ Displacement",
  "intent-spike-notifier": "🔥 Intent Spike",
};

export default function OutreachApprovalQueue() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("outreach_approval_queue" as any)
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
      toast.error("Failed to load approval queue");
    } else {
      setRows((data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("outreach_approval_queue_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_approval_queue" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const act = async (action: "approve" | "reject", ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("outreach-queue-action", {
      body: { action: action === "approve" ? "batch_approve" : "reject", ids },
    });
    setBusy(false);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    if (action === "approve") {
      const r = data as any;
      toast.success(`Sent ${r.sent || 0} · queued ${r.queued || 0} · failed ${r.failed || 0}`);
    } else {
      toast.success(`Rejected ${ids.length}`);
    }
    setSelected(new Set());
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#00d4ff]" /> Outreach Approval Queue
          </h2>
          <p className="text-white/50 text-sm">{rows.length} drafts pending — every auto-generated pitch lands here. Tap approve to send.</p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy || selected.size === 0}
            onClick={() => act("approve", Array.from(selected))}
            className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-30 text-xs font-bold flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> Approve {selected.size || ""}
          </button>
          <button
            disabled={busy || selected.size === 0}
            onClick={() => act("reject", Array.from(selected))}
            className="px-3 py-2 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 disabled:opacity-30 text-xs font-bold flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Reject {selected.size || ""}
          </button>
          <button
            disabled={busy || rows.length === 0}
            onClick={() => act("approve", rows.map((r) => r.id))}
            className="px-3 py-2 rounded-lg bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 disabled:opacity-30 text-xs font-bold flex items-center gap-1"
          >
            <Zap className="w-3 h-3" /> Approve All
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/50 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-white/40 text-sm p-12 text-center border border-dashed border-white/10 rounded-lg">
          🎉 Queue is clear. New drafts appear in real time as the spike notifier, TechAlert pitcher, and displacement detector run.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className={`rounded-lg border p-3 transition-colors ${selected.has(r.id) ? "border-[#00d4ff] bg-[#00d4ff]/5" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-mono">{SOURCE_LABEL[r.source_function] || r.source_function}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono flex items-center gap-1">
                      {r.channel === "email" ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />} {r.channel}
                    </span>
                    {r.confidence_score != null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">conf {Math.round(r.confidence_score * 100)}%</span>
                    )}
                    <span className="font-bold text-white">{r.account_name || "Unknown"}</span>
                    {r.account_location && <span className="text-xs text-white/50">· {r.account_location}</span>}
                  </div>
                  {r.signal_reason && <div className="text-xs text-amber-300/80 mt-1">⚡ {r.signal_reason}</div>}
                  {r.draft_subject && <div className="text-sm text-white/80 mt-2 font-semibold">Subj: {r.draft_subject}</div>}
                  <div className="text-xs text-white/60 mt-2 whitespace-pre-wrap line-clamp-6">{r.draft_body}</div>
                  {!r.recipient_email && !r.recipient_phone && (
                    <div className="text-[10px] text-amber-300 mt-2">⚠️ No recipient address — approval will mark for manual fulfillment.</div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    disabled={busy}
                    onClick={() => act("approve", [r.id])}
                    className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-bold disabled:opacity-30"
                  >✓ Send</button>
                  <button
                    disabled={busy}
                    onClick={() => act("reject", [r.id])}
                    className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[10px] font-bold disabled:opacity-30"
                  >✗ Skip</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
