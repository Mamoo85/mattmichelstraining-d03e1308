import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, Mail, Calendar, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type TierKey = "snapshot" | "weekly" | "enterprise";

const TIER_DETAILS: Record<TierKey, {
  name: string;
  price: string;
  cadence: string;
  recurring: boolean;
  perks: string[];
  next: string;
}> = {
  snapshot: {
    name: "One-Time Snapshot",
    price: "$99",
    cadence: "one-time",
    recurring: false,
    perks: [
      "Current Metro Detroit predictive sales signals",
      "MIOSHA gaps, expansion patterns, bond filings",
      "Delivered as PDF + CSV within 24 hours",
    ],
    next: "Watch your inbox — your snapshot dossier ships within one business day.",
  },
  weekly: {
    name: "Weekly Digest",
    price: "$199",
    cadence: "per month",
    recurring: true,
    perks: [
      "New predictive signals every Tuesday at 7am ET",
      "Cross-referenced hiring + permit + bond intelligence",
      "Cancel anytime from your billing portal",
    ],
    next: "Your first digest arrives next Tuesday at 7am ET.",
  },
  enterprise: {
    name: "Enterprise — Daily Firehose",
    price: "$499",
    cadence: "per month",
    recurring: true,
    perks: [
      "Daily statewide predictive intelligence",
      "Live dashboard + API access",
      "Cross-referenced high-priority alerts",
    ],
    next: "Your dashboard credentials and API key arrive within 1 business hour.",
  },
};

export default function IndustrialPulseReceipt() {
  const [params] = useSearchParams();
  const tier = (params.get("tier") as TierKey) || "weekly";
  const success = params.get("success") === "1";
  const sessionId = params.get("session_id") || "";

  const details = TIER_DETAILS[tier] || TIER_DETAILS.weekly;
  const [portalLoading, setPortalLoading] = useState(false);

  // Fire a lightweight conversion ping (best-effort, non-blocking)
  useEffect(() => {
    if (!success) return;
    try {
      (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.("event", "purchase", {
        transaction_id: sessionId || `pulse_${Date.now()}`,
        value: tier === "snapshot" ? 99 : tier === "weekly" ? 199 : 499,
        currency: "USD",
        items: [{ item_id: `industrial_pulse_${tier}`, item_name: details.name }],
      });
    } catch {/* noop */}
  }, [success, sessionId, tier, details.name]);

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", { body: {} });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch {
      window.location.href = "mailto:matt@detroitwebagent.com?subject=Industrial%20Pulse%20billing";
    } finally {
      setPortalLoading(false);
    }
  };

  const unsubscribeUrl = useMemo(() => {
    const email = params.get("email") || "";
    const base = "https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/industrial-pulse-unsubscribe";
    return email ? `${base}?email=${encodeURIComponent(email)}` : base;
  }, [params]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <Helmet>
        <title>Receipt — Detroit Industrial Pulse</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
        {/* Brand bar */}
        <div className="mb-8 flex items-center gap-2 text-[11px] font-bold tracking-[0.3em] text-cyan-400">
          <span>DETROIT INDUSTRIAL PULSE</span>
        </div>

        {/* Status hero */}
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 shadow-[0_0_60px_-15px_rgba(0,212,255,0.4)]">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-cyan-500/20 p-3">
              <CheckCircle2 className="h-7 w-7 text-cyan-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white sm:text-4xl">
                {success ? "You're in." : "Order received."}
              </h1>
              <p className="mt-2 text-slate-400">
                Thanks for subscribing to <span className="text-white">{details.name}</span>. A receipt is on its way to your inbox from Stripe.
              </p>
            </div>
          </div>

          {/* Plan card */}
          <div className="mt-8 rounded-xl border border-slate-700/60 bg-slate-950/60 p-5">
            <div className="flex items-baseline justify-between border-b border-slate-800 pb-3">
              <span className="text-xs uppercase tracking-widest text-slate-500">Plan</span>
              <span className="text-sm font-semibold text-white">{details.name}</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-slate-800 py-3">
              <span className="text-xs uppercase tracking-widest text-slate-500">Price</span>
              <span className="text-sm font-semibold text-white">
                {details.price} <span className="text-slate-500">{details.cadence}</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between py-3">
              <span className="text-xs uppercase tracking-widest text-slate-500">Type</span>
              <span className="text-sm font-semibold text-white">
                {details.recurring ? "Recurring subscription" : "One-time purchase"}
              </span>
            </div>
            {sessionId && (
              <div className="mt-1 truncate border-t border-slate-800 pt-3 text-[11px] text-slate-600">
                Ref: {sessionId}
              </div>
            )}
          </div>

          {/* What's included */}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-cyan-400">
              <Sparkles className="h-3.5 w-3.5" /> What you get
            </div>
            <ul className="space-y-2">
              {details.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Next steps */}
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-300">
            <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" />
            <span>{details.next}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {details.recurring && (
            <Button
              onClick={handleManage}
              disabled={portalLoading}
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Manage subscription
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          <Button asChild variant="outline" className="border-slate-700 bg-slate-900/50 text-slate-200 hover:bg-slate-800">
            <a href="mailto:matt@detroitwebagent.com?subject=Industrial%20Pulse%20question">
              <Mail className="mr-2 h-4 w-4" /> Email support
            </a>
          </Button>
        </div>

        {/* Footer links */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-6 text-xs text-slate-500">
          <Link to="/industrial-pulse" className="hover:text-cyan-400">← Back to Industrial Pulse</Link>
          {details.recurring && (
            <a href={unsubscribeUrl} className="hover:text-rose-400">Unsubscribe from emails</a>
          )}
        </div>
      </div>
    </div>
  );
}
