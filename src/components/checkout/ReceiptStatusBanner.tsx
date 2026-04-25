import { CheckCircle, Loader2, AlertTriangle, RotateCw, Mail, MessageSquare } from "lucide-react";
import { useReceiptStatus } from "@/hooks/useReceiptStatus";

interface Props {
  /** Stripe checkout session id (?session_id=...) */
  sessionId: string | null | undefined;
  /** Optional product label for display. */
  productLabel?: string;
  className?: string;
}

const SUPPORT_EMAIL = "matt@detroitwebagent.com";
const SUPPORT_PHONE = "+13139921219";
const SUPPORT_PHONE_DISPLAY = "(313) 992-1219";

/**
 * Drop-in banner that shows the customer the live state of their Stripe
 * checkout: pending → paid → fulfilled, with an explicit error state if the
 * webhook reports a failure and a recovery state with retry + support
 * actions if the 60s polling window elapses.
 */
export default function ReceiptStatusBanner({ sessionId, productLabel, className = "" }: Props) {
  const { status, polling, error, fulfilledAt, timedOut, retry, retries } = useReceiptStatus(sessionId);

  if (!sessionId) return null;

  const base = `rounded-xl border p-4 text-sm flex items-start gap-3 ${className}`;

  // Hard timeout — customer needs an actionable next step
  if (timedOut && status !== "fulfilled" && status !== "failed") {
    const subject = encodeURIComponent(`Receipt pending — session ${sessionId}`);
    const body = encodeURIComponent(
      `Hi Matt,\n\nMy payment went through but the success page hasn't confirmed fulfillment after 60+ seconds.\n\nSession ID: ${sessionId}\nProduct: ${productLabel ?? "—"}\n\nThanks.`
    );
    const smsBody = encodeURIComponent(`Receipt pending for session ${sessionId}`);
    const retriesLeft = Math.max(0, 3 - retries);

    return (
      <div
        className={`${base} flex-col items-stretch border-amber-500/40 bg-amber-500/10 text-amber-100`}
        data-testid="receipt-banner-timeout"
        role="status"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-50">Taking longer than usual</div>
            <div className="opacity-90 mt-1">
              Stripe likely confirmed your payment, but our system hasn't finished provisioning yet.
              Your card is safe — we'll fix this personally if it doesn't clear up in a minute.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 pl-7">
          <button
            type="button"
            onClick={retry}
            disabled={retriesLeft === 0}
            data-testid="receipt-banner-retry"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-amber-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: 44, touchAction: "manipulation" }}
          >
            <RotateCw size={14} /> Retry check {retriesLeft > 0 ? `(${retriesLeft} left)` : ""}
          </button>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-amber-500/20"
            style={{ minHeight: 44, touchAction: "manipulation" }}
          >
            <Mail size={14} /> Email Matt
          </a>
          <a
            href={`sms:${SUPPORT_PHONE}?&body=${smsBody}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-amber-500/20"
            style={{ minHeight: 44, touchAction: "manipulation" }}
          >
            <MessageSquare size={14} /> Text {SUPPORT_PHONE_DISPLAY}
          </a>
        </div>
      </div>
    );
  }

  if (error && !polling && status === "unknown") {
    return (
      <div
        className={`${base} border-amber-500/40 bg-amber-500/10 text-amber-200`}
        data-testid="receipt-banner-error"
        role="status"
      >
        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">We couldn't confirm your receipt yet</div>
          <div className="opacity-80">
            If your card was charged you'll get a confirmation email. Otherwise text Matt at{" "}
            {SUPPORT_PHONE_DISPLAY} and we'll fix it.
          </div>
        </div>
      </div>
    );
  }

  if (status === "fulfilled") {
    return (
      <div
        className={`${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`}
        data-testid="receipt-banner-fulfilled"
        role="status"
      >
        <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Receipt ready{productLabel ? ` — ${productLabel}` : ""}</div>
          <div className="opacity-80">
            Your account is provisioned and a receipt was emailed to you
            {fulfilledAt ? ` at ${new Date(fulfilledAt).toLocaleTimeString()}` : ""}.
          </div>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div
        className={`${base} border-red-500/40 bg-red-500/10 text-red-200`}
        data-testid="receipt-banner-failed"
        role="status"
      >
        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Fulfillment failed</div>
          <div className="opacity-80">
            Your card may have been charged. Email {SUPPORT_EMAIL} with this page open and we'll fix it
            immediately.
          </div>
        </div>
      </div>
    );
  }

  // paid / pending / unknown while polling
  return (
    <div
      className={`${base} border-cyan-500/40 bg-cyan-500/10 text-cyan-200`}
      data-testid="receipt-banner-pending"
      role="status"
    >
      <Loader2 size={18} className="flex-shrink-0 mt-0.5 animate-spin" />
      <div>
        <div className="font-bold">
          {status === "paid"
            ? "Payment received — provisioning your account…"
            : "Confirming your payment…"}
        </div>
        <div className="opacity-80">This usually takes a few seconds. You can leave this page open.</div>
      </div>
    </div>
  );
}
