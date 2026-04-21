// ResendSmsModal — Admin confirmation step before resending an SMS.
// Shows the EXACT body that will be sent, optional template swap, and
// generates a stable Idempotency-Key so double-clicks don't double-send.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ResendTarget {
  message_id?: string;        // preferred — pulls body_full from system_comms_log
  recipient: string;          // E.164
  body: string;               // current/last known body for preview
  product?: string | null;
  sent_at?: string | null;
  body_full_stored?: boolean; // false = only preview exists, force template
}

interface Template {
  id: string;
  description: string;
  vars: readonly string[];
  product: string;
}

const HARDCODED_TEMPLATES: Template[] = [
  { id: "electrician_lock_in_v1", description: "Electrician — initial lock-in offer", vars: ["city"], product: "contractor_pitch" },
  { id: "electrician_bump_v1", description: "Electrician — bump (resend of lock-in offer)", vars: ["city"], product: "contractor_pitch" },
  { id: "contractor_pitch_generic_v1", description: "Contractor — generic lock-in offer (any trade)", vars: ["trade", "city"], product: "contractor_pitch" },
  { id: "contractor_dead_lead_pitch_v1", description: "Contractor — dead-lead reactivation pitch", vars: ["business_name"], product: "contractor_pitch" },
  { id: "contractor_welcome_v1", description: "Contractor — welcome after signup", vars: ["business_name", "trade", "city"], product: "contractor_welcome" },
  { id: "contractor_lead_alert_v1", description: "Contractor — new lead alert", vars: ["lead_name", "lead_phone", "trade", "city", "details"], product: "contractor_lead_alert" },
  { id: "contractor_renewal_v1", description: "Contractor — monthly renewal confirmation", vars: ["business_name", "amount"], product: "contractor_renewal" },
  { id: "contractor_territory_lock_v1", description: "Contractor — territory lock upsell", vars: ["trade", "city"], product: "contractor_upsell" },
];

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ResendSmsModal({
  target,
  onClose,
  onSent,
}: {
  target: ResendTarget;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [mode, setMode] = useState<"same" | "template">(
    target.body_full_stored === false ? "template" : "same",
  );
  const [templateId, setTemplateId] = useState<string>(HARDCODED_TEMPLATES[0].id);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [force, setForce] = useState(false);
  // Stable per-mount idempotency key — re-clicking "Send" reuses the same key
  const idempotencyKey = useMemo(() => uuid(), []);

  const selectedTemplate = HARDCODED_TEMPLATES.find((t) => t.id === templateId);

  // Locally render template preview so admin sees what's about to go out.
  const previewBody = useMemo(() => {
    if (mode === "same") return target.body;
    if (!selectedTemplate) return "";
    let body = templateBodyById(selectedTemplate.id);
    for (const v of selectedTemplate.vars) {
      const val = vars[v];
      body = body.split(`{${v}}`).join(val && val.trim() ? val : `{${v}}`);
    }
    return body;
  }, [mode, target.body, selectedTemplate, vars]);

  // Reset vars when template changes
  useEffect(() => {
    setVars({});
  }, [templateId]);

  const missingVars = mode === "template" && selectedTemplate
    ? selectedTemplate.vars.filter((v) => !vars[v]?.trim())
    : [];
  const canSend = !sending && previewBody.trim().length > 0 && missingVars.length === 0;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        recipient: target.recipient,
        force,
      };
      if (mode === "same") {
        if (target.message_id && target.body_full_stored !== false) {
          body.source_message_id = target.message_id;
        } else {
          body.body = target.body;
          body.product = target.product ?? "dwa_admin_reply";
        }
      } else {
        body.template_id = templateId;
        body.vars = vars;
      }

      const { data, error } = await supabase.functions.invoke("dwa-resend-sms", {
        body,
        headers: { "Idempotency-Key": idempotencyKey },
      });
      if (error) throw error;
      const result = data as {
        success?: boolean;
        skipped?: boolean;
        reason?: string;
        replayed?: boolean;
        sid?: string;
        error?: string;
      };
      if (result.replayed) {
        toast.info("Cached response replayed — no duplicate send");
        onSent?.();
        onClose();
        return;
      }
      if (result.skipped && result.reason === "duplicate_within_24h") {
        toast.warning("Same message was already sent in the last 24h. Tick 'Force send' to override.");
        return;
      }
      if (!result.success) {
        toast.error(result.error || "Send failed");
        return;
      }
      toast.success(`Sent (SID ${result.sid?.slice(0, 8)}…)`);
      onSent?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#0f1f33] border border-[#00d4ff]/30 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">↻ Resend SMS</h2>
              <p className="text-white/50 text-xs mt-1">
                To <span className="text-[#00d4ff] font-mono">{target.recipient}</span>
                {target.sent_at && <> · last sent {new Date(target.sent_at).toLocaleString()}</>}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("same")}
              disabled={target.body_full_stored === false}
              className={`px-3 py-1.5 rounded text-xs font-semibold border ${
                mode === "same"
                  ? "bg-[#00d4ff] text-[#0a1628] border-[#00d4ff]"
                  : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={target.body_full_stored === false ? "Original full body not stored — pick a template" : ""}
            >
              Same message
            </button>
            <button
              onClick={() => setMode("template")}
              className={`px-3 py-1.5 rounded text-xs font-semibold border ${
                mode === "template"
                  ? "bg-[#00d4ff] text-[#0a1628] border-[#00d4ff]"
                  : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
              }`}
            >
              Pick a template
            </button>
          </div>

          {mode === "template" && (
            <div className="space-y-3">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
              >
                {HARDCODED_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#0a1628]">
                    {t.description} ({t.id})
                  </option>
                ))}
              </select>
              {selectedTemplate && selectedTemplate.vars.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedTemplate.vars.map((v) => (
                    <label key={v} className="text-xs text-white/60 flex flex-col gap-1">
                      <span className="font-mono">{v}</span>
                      <input
                        value={vars[v] ?? ""}
                        onChange={(e) => setVars((prev) => ({ ...prev, [v]: e.target.value }))}
                        placeholder={v}
                        className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="text-xs text-white/50 uppercase tracking-wide mb-1.5">Body to send</div>
            <pre className="font-mono text-sm text-white whitespace-pre-wrap bg-black/40 border border-white/10 rounded p-3 max-h-60 overflow-y-auto">
              {previewBody}
            </pre>
            {missingVars.length > 0 && (
              <div className="text-amber-400 text-xs mt-2">
                Fill in: {missingVars.join(", ")}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="accent-[#00d4ff]"
            />
            Force send (override 24h duplicate guard)
          </label>

          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            ⚠️ This will text the message above to <span className="font-mono">{target.recipient}</span>.
            Twilio SID will be logged. Idempotency key: <span className="font-mono">{idempotencyKey.slice(0, 8)}…</span>
          </div>
        </div>

        <div className="p-5 border-t border-white/10 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 rounded text-sm font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="px-4 py-2 rounded text-sm font-bold bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending…" : "Send exact message"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Local mirror of template bodies for client-side preview (server is the source of truth).
function templateBodyById(id: string): string {
  switch (id) {
    case "electrician_lock_in_v1":
      return "Hey — Matt with Detroit Web Agency. Locked in for you: {city} Electrical, $399/mo flat. No setup fee, no contract, cancel anytime. 30-day refund if zero leads delivered. All bonus services included free (missed-call catch, ROI scorecard, dead-lead reactivation — totally optional, opt-in). Want me to send the signup link so we can get you live today?";
    case "electrician_bump_v1":
      return "Hey — Matt with Detroit Web Agency, just bumping our last text so it doesn't get buried. Locked in for you: {city} Electrical, $399/mo flat. No setup fee, no contract, cancel anytime. 30-day refund if zero leads delivered. All bonus services included free (missed-call catch, ROI scorecard, dead-lead reactivation — totally optional, opt-in). Want me to send the signup link so we can get you live today?";
    case "contractor_pitch_generic_v1":
      return "Hey — Matt with Detroit Web Agency. Locked in for you: {city} {trade}, $399/mo flat. No setup fee, no contract, cancel anytime. 30-day refund if zero leads delivered. All bonus services included free (missed-call catch, ROI scorecard, dead-lead reactivation — opt-in). Want me to send the signup link so we can get you live today?";
    case "contractor_dead_lead_pitch_v1":
      return "Hey {business_name} — Matt with Detroit Web Agency. Most contractors have 100+ old quotes that ghosted. I'll text them on YOUR behalf with a 3-message reactivation drip. You only pay $50 per positive reply. Zero cost if nothing comes back. Want me to load your old quotes and run it this week?";
    case "contractor_welcome_v1":
      return "Welcome aboard, {business_name}! You're now locked in as the exclusive {trade} for {city}. Leads go straight to your phone the second they come in — first call usually wins. Reply STOP to opt out anytime. — Matt, Detroit Web Agency (313) 992-1219";
    case "contractor_lead_alert_v1":
      return "🔥 NEW {trade} LEAD — {city}\n{lead_name} · {lead_phone}\n{details}\nCall NOW — first to contact wins.";
    case "contractor_renewal_v1":
      return "{business_name} — your $399/mo Detroit Web Agency territory just renewed (${amount}). Reply with any questions. — Matt (313) 992-1219";
    case "contractor_territory_lock_v1":
      return "You've grabbed 3 leads this week — want me to lock {city} {trade} exclusively to you? $399/mo flat, no other contractor in your trade gets a single lead in your city. Reply YES and I'll set it up tonight.";
    default:
      return "";
  }
}
