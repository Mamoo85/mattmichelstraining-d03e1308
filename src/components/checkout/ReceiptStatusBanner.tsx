import { CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { useReceiptStatus } from "@/hooks/useReceiptStatus";

interface Props {
  /** Stripe checkout session id (?session_id=...) */
  sessionId: string | null | undefined;
  /** Optional product label for display. */
  productLabel?: string;
  className?: string;
}

/**
 * Drop-in banner that shows the customer the live state of their Stripe
 * checkout: pending → paid → fulfilled, with explicit error state if the
 * webhook reports a failure or polling times out.
 */
export default function ReceiptStatusBanner({ sessionId, productLabel, className = "" }: Props) {
  const { status, polling, error, fulfilledAt } = useReceiptStatus(sessionId);

  if (!sessionId) return null;

  const base = `rounded-xl border p-4 text-sm flex items-start gap-3 ${className}`;

  if (error && !polling && status === "unknown") {
    return (
      <div className={`${base} border-amber-500/40 bg-amber-500/10 text-amber-200`} data-testid="receipt-banner-error">
        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">We couldn't confirm your receipt yet</div>
          <div className="opacity-80">If your card was charged, you'll get a confirmation email. Otherwise reply to this page and we'll fix it.</div>
        </div>
      </div>
    );
  }

  if (status === "fulfilled") {
    return (
      <div className={`${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`} data-testid="receipt-banner-fulfilled">
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
      <div className={`${base} border-red-500/40 bg-red-500/10 text-red-200`} data-testid="receipt-banner-failed">
        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Fulfillment failed</div>
          <div className="opacity-80">Your card may have been charged. Email matt@detroitwebagent.com with this page open and we'll fix it immediately.</div>
        </div>
      </div>
    );
  }

  // paid / pending / unknown while polling
  return (
    <div className={`${base} border-cyan-500/40 bg-cyan-500/10 text-cyan-200`} data-testid="receipt-banner-pending">
      <Loader2 size={18} className="flex-shrink-0 mt-0.5 animate-spin" />
      <div>
        <div className="font-bold">
          {status === "paid" ? "Payment received — provisioning your account…" : "Confirming your payment…"}
        </div>
        <div className="opacity-80">This usually takes a few seconds. You can leave this page open.</div>
      </div>
    </div>
  );
}
