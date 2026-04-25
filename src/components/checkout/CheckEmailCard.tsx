import { Mail, MessageSquare } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ActionButton from "@/components/ui/action-button";
import { toastSuccess, toastError } from "@/lib/toast";

interface Props {
  sessionId: string | null | undefined;
  email?: string | null;
  /** Banner status from useReceiptStatus — only render when paid/fulfilled/pending. */
  status?: "pending" | "paid" | "fulfilled" | "failed" | "unknown";
  className?: string;
}

const SUPPORT_PHONE = "+13139921219";
const SUPPORT_PHONE_DISPLAY = "(313) 992-1219";

/**
 * Reassuring "Check your email" panel rendered next to the receipt banner
 * on success pages. Lets the customer trigger a one-tap resend through
 * the resend-receipt edge function (rate-limited server-side).
 */
export default function CheckEmailCard({ sessionId, email, status = "pending", className = "" }: Props) {
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (!sessionId) return null;
  if (status === "failed" || status === "unknown") return null;

  const handleResend = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("resend-receipt", {
        body: { session_id: sessionId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSentTo(data?.sent_to ?? email ?? null);
      toastSuccess("Receipt resent", `We sent it to ${data?.sent_to ?? "the email on file"}.`);
    } catch (err: any) {
      toastError("Couldn't resend the receipt", err?.message);
    }
  };

  return (
    <div
      className={`rounded-xl border border-cyan-500/30 bg-slate-900/60 p-4 sm:p-5 ${className}`}
      data-testid="check-email-card"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-300">
          <Mail size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-slate-100">Check your email for the receipt</div>
          <div className="mt-1 text-sm text-slate-400">
            {email ? (
              <>
                Stripe sent it to <span className="font-semibold text-slate-200">{email}</span>. It usually
                lands within a minute.
              </>
            ) : (
              <>Stripe sent it to the address you used at checkout. It usually lands within a minute.</>
            )}
          </div>

          {sentTo && (
            <div className="mt-2 text-xs text-emerald-300" data-testid="check-email-resend-confirm">
              Resent to {sentTo}.
            </div>
          )}

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <div className="sm:flex-1">
              <ActionButton
                onClick={handleResend}
                variant="primary"
                busyLabel="Sending…"
                ariaLabel="Resend receipt email"
              >
                Resend receipt
              </ActionButton>
            </div>
            <a
              href={`sms:${SUPPORT_PHONE}?&body=${encodeURIComponent(
                `Wrong email on receipt for session ${sessionId}`
              )}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-slate-800"
              style={{ minHeight: 52, touchAction: "manipulation" }}
            >
              <MessageSquare size={14} /> Wrong email? Text {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
