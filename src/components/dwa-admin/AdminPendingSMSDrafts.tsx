// Pending SMS Drafts admin panel.
// Lists every AI-generated reply draft (from auto-draft-on-inbound) that's
// still pending and lets Matt preview, edit inline, then either approve
// (send as-is) or send a customized version — all with one click, no SMS
// round-trip required. Mirrors the "A" / "E ..." flow in inbound-sms-relay
// but with a real UI for use at a desk instead of from a phone.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Draft = {
  id: string;
  phone: string;
  draft_body: string;
  inbound_body: string | null;
  status: string;
  created_at: string;
};

const formatPhone = (e164: string) => {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
};

const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function AdminPendingSMSDrafts() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("sms_reply_drafts")
      .select("id, phone, draft_body, inbound_body, status, created_at")
      .in("status", ["pending", "failed"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error(`Load failed: ${error.message}`);
    } else {
      setDrafts((data ?? []) as Draft[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // soft poll every 15s
    return () => clearInterval(t);
  }, [load]);

  const send = async (draft: Draft, customized: boolean) => {
    const finalBody = (edits[draft.id] ?? draft.draft_body).trim();
    if (!finalBody) {
      toast.error("Message body is empty");
      return;
    }

    setBusyId(draft.id);
    try {
      const { data, error } = await supabase.functions.invoke("dwa-send-sms", {
        body: { to: draft.phone, body: finalBody },
      });

      if (error || (data && data.success === false)) {
        const msg = (data && data.error) || error?.message || "Send failed";
        await supabase
          .from("sms_reply_drafts")
          .update({ status: "failed" })
          .eq("id", draft.id);
        toast.error(msg);
        return;
      }

      await supabase
        .from("sms_reply_drafts")
        .update({
          status: customized ? "edited" : "sent",
          sent_at: new Date().toISOString(),
          draft_body: finalBody,
        })
        .eq("id", draft.id);

      toast.success(`Sent to ${formatPhone(draft.phone)}`);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[draft.id];
        return next;
      });
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const discard = async (draft: Draft) => {
    if (!confirm("Discard this draft? It won't be sent.")) return;
    setBusyId(draft.id);
    const { error } = await supabase
      .from("sms_reply_drafts")
      .update({ status: "discarded" })
      .eq("id", draft.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Discarded");
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Pending SMS Drafts</h2>
          <p className="text-white/50 text-xs mt-1">
            AI-generated replies waiting for your approval. Edit inline, then approve or customize.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          className="border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10"
        >
          ↻ Refresh
        </Button>
      </div>

      {loading && <div className="text-white/40 text-sm">Loading drafts…</div>}

      {!loading && drafts.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <div className="text-3xl mb-2">📭</div>
          <div className="text-white/60 text-sm">No pending drafts. Inbox is clean.</div>
        </div>
      )}

      <div className="space-y-3">
        {drafts.map((d) => {
          const editedBody = edits[d.id] ?? d.draft_body;
          const isEdited = editedBody.trim() !== d.draft_body.trim();
          const charCount = editedBody.length;
          const overLimit = charCount > 1500;
          const busy = busyId === d.id;

          return (
            <div
              key={d.id}
              className="rounded-xl border border-white/10 bg-[#0f1d33] p-4 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white">
                    {formatPhone(d.phone)}
                  </span>
                  {d.status === "failed" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                      RETRY
                    </span>
                  )}
                  {isEdited && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      EDITED
                    </span>
                  )}
                </div>
                <span className="text-white/40 text-xs">{timeAgo(d.created_at)}</span>
              </div>

              {d.inbound_body && (
                <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                  <div className="text-white/40 text-[10px] uppercase tracking-wide mb-1">
                    They said
                  </div>
                  <div className="text-white/80 text-sm whitespace-pre-wrap">
                    {d.inbound_body}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-white/40 text-[10px] uppercase tracking-wide">
                    AI draft reply
                  </div>
                  <div
                    className={`text-[10px] font-mono ${
                      overLimit ? "text-red-400" : "text-white/40"
                    }`}
                  >
                    {charCount} chars
                  </div>
                </div>
                <Textarea
                  value={editedBody}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [d.id]: e.target.value }))
                  }
                  rows={4}
                  className="bg-[#0a1628] border-white/10 text-white text-sm resize-y min-h-[96px]"
                  disabled={busy}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {!isEdited ? (
                  <Button
                    onClick={() => send(d, false)}
                    disabled={busy || overLimit}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
                  >
                    {busy ? "Sending…" : "✓ Approve & Send"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => send(d, true)}
                    disabled={busy || overLimit}
                    className="bg-[#00d4ff] hover:bg-[#00d4ff]/80 text-black font-semibold"
                  >
                    {busy ? "Sending…" : "✎ Send Customized"}
                  </Button>
                )}

                {isEdited && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setEdits((prev) => {
                        const next = { ...prev };
                        delete next[d.id];
                        return next;
                      })
                    }
                    disabled={busy}
                    className="border-white/20 text-white/70 hover:bg-white/5"
                  >
                    Reset
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => discard(d)}
                  disabled={busy}
                  className="border-red-500/30 text-red-300 hover:bg-red-500/10 ml-auto"
                >
                  Discard
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
