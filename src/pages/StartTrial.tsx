import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Maps offers.ts product keys -> the existing checkout edge function name + payload shape.
// Keep this list in sync with supabase/functions/_shared/offers.ts.
const PRODUCT_CHECKOUT: Record<
  string,
  { fn: string; payloadHint: string; productLabel: string; trial: boolean }
> = {
  mortgage_radar: { fn: "create-mortgage-radar-checkout", payloadHint: "lo", productLabel: "Mortgage Radar", trial: true },
  trade_radar: { fn: "create-trade-radar-checkout", payloadHint: "trade", productLabel: "Trade Radar", trial: true },
  field_desk: { fn: "create-field-crm-checkout", payloadHint: "field", productLabel: "FieldDesk", trial: true },
  site_radar: { fn: "create-site-radar-checkout", payloadHint: "site", productLabel: "SiteRadar", trial: true },
  missed_call_catch: { fn: "create-missed-call-subscription", payloadHint: "missed", productLabel: "Missed-Call Catch", trial: true },
  phone_answering: { fn: "create-phone-answering-checkout", payloadHint: "phone", productLabel: "AI Phone Answering", trial: true },
  bundle_revenue_suite: { fn: "create-bundle-revenue-suite-checkout", payloadHint: "bundle", productLabel: "Revenue Suite Bundle", trial: true },
  techalert: { fn: "create-hire-alert-checkout", payloadHint: "hire", productLabel: "TechAlert", trial: false },
  contractor_leads: { fn: "create-contractor-checkout", payloadHint: "contractor", productLabel: "Contractor Leads", trial: false },
  dead_lead: { fn: "create-dead-lead-billing-setup", payloadHint: "dead", productLabel: "Dead Lead Reactivation", trial: false },
};

export default function StartTrial() {
  const [params] = useSearchParams();
  const product = params.get("product") || "";
  const config = PRODUCT_CHECKOUT[product];

  const [email, setEmail] = useState(params.get("email") || "");
  const [businessName, setBusinessName] = useState(params.get("business") || "");
  const [phone, setPhone] = useState(params.get("phone") || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = config
      ? `${config.trial ? "Start your 7-day free trial" : "Get started"} · ${config.productLabel}`
      : "Start trial";
  }, [config]);

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1628] text-white p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold">Unknown product</h1>
          <p className="text-white/70">
            This trial link is missing or invalid. Email{" "}
            <a className="text-[#00d4ff] underline" href="mailto:matt@detroitwebagent.com">matt@detroitwebagent.com</a> and we'll get you sorted.
          </p>
        </div>
      </div>
    );
  }

  async function startCheckout(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Send the broadest payload — each checkout fn picks what it needs and ignores the rest.
      const body = {
        email,
        businessName,
        business_name: businessName,
        company: businessName,
        name: "",
        phone,
        city: "",
        website: "",
      };
      const { data, error: fnError } = await (supabase.functions as any).invoke(config.fn, { body });
      if (fnError) throw fnError;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Checkout did not return a URL.");
    } catch (e: any) {
      setError(e?.message || "Something went wrong starting your trial.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#0d1f3c] text-white">
      <div className="max-w-xl mx-auto p-6 sm:p-10">
        <div className="text-center mb-8">
          <div className="text-[#00d4ff] text-sm font-bold tracking-wider uppercase">{config.productLabel}</div>
          <h1 className="text-3xl sm:text-4xl font-black mt-2">
            {config.trial ? "Start your 7-day free trial" : "Get started"}
          </h1>
          {config.trial && (
            <p className="text-white/70 mt-3">
              No credit card required. Then 50% off your first 3 months.
            </p>
          )}
          {product === "dead_lead" && (
            <p className="text-white/70 mt-3">
              Your <strong>first positive reply is free</strong>. $50/yes after that. Cancel any time.
            </p>
          )}
        </div>

        <form onSubmit={startCheckout} className="bg-[#0a1628]/60 border border-[#00d4ff]/30 rounded-xl p-6 space-y-4">
          <label className="block">
            <span className="text-sm text-white/70">Work email</span>
            <input
              required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 bg-[#0a1628] border border-white/20 rounded px-3 py-2 text-white"
            />
          </label>
          <label className="block">
            <span className="text-sm text-white/70">Business name</span>
            <input
              required value={businessName} onChange={(e) => setBusinessName(e.target.value)}
              className="w-full mt-1 bg-[#0a1628] border border-white/20 rounded px-3 py-2 text-white"
            />
          </label>
          {(product === "missed_call_catch" || product === "phone_answering" || product === "field_desk") && (
            <label className="block">
              <span className="text-sm text-white/70">Business phone</span>
              <input
                required={product === "missed_call_catch"}
                value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="(313) 555-0123"
                className="w-full mt-1 bg-[#0a1628] border border-white/20 rounded px-3 py-2 text-white"
              />
            </label>
          )}
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button
            type="submit" disabled={busy}
            className="w-full bg-[#00d4ff] text-[#0a1628] font-bold py-3 rounded text-base disabled:opacity-50"
          >
            {busy ? "Starting…" : (config.trial ? "Start 7-day free trial" : "Continue")}
          </button>
          <p className="text-[10px] text-white/40 text-center">
            By continuing you agree to our terms. Questions? <a href="mailto:matt@detroitwebagent.com" className="text-[#00d4ff]">matt@detroitwebagent.com</a>.
          </p>
        </form>
      </div>
    </div>
  );
}
