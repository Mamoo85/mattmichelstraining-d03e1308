import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackTrialEvent } from "@/lib/trialFunnel";

// ────────────────────────────────────────────────────────────────────
// Canonical product config
// ────────────────────────────────────────────────────────────────────
type CanonicalKey =
  | "mortgage_radar"
  | "field_desk"
  | "site_radar"
  | "missed_call_catch"
  | "phone_answering"
  | "bundle_revenue_suite"
  | "techalert"
  | "contractor_leads"
  | "dead_lead"
  | "trade_radar_roofing"
  | "trade_radar_hvac"
  | "trade_radar_plumbing"
  | "trade_radar_electrical"
  | "trade_radar_pest_control"
  | "trade_radar_gutters"
  | "trade_radar_exterior"
  | "trade_radar_tree"
  | "trade_radar_restoration"
  | "trade_radar_demo_junk"
  | "trade_radar_foundation";

type ResolvedProductKey = CanonicalKey;

interface ProductDef {
  fn: string;
  label: string;
  trial: boolean;
  needsPhone?: boolean;
  needsWebsite?: boolean;
  // Trade Radar verticals share a checkout but pass `vertical`
  vertical?: string;
  // Optional landing page URL we redirect to instead of running this generic form
  externalLandingUrl?: string;
}

const PRODUCTS: Record<CanonicalKey, ProductDef> = {
  mortgage_radar:       { fn: "start-radar-trial", label: "Mortgage Radar", trial: true, needsPhone: true },
  field_desk:           { fn: "create-field-crm-checkout", label: "FieldDesk", trial: true, needsPhone: true },
  site_radar:           { fn: "create-site-radar-checkout", label: "SiteRadar", trial: true, needsWebsite: true },
  missed_call_catch:    { fn: "create-missed-call-subscription", label: "Missed-Call Catch", trial: true, needsPhone: true },
  phone_answering:      { fn: "create-phone-answering-checkout", label: "AI Phone Answering", trial: true, needsPhone: true },
  bundle_revenue_suite: { fn: "create-bundle-revenue-suite-checkout", label: "Revenue Suite Bundle", trial: true, needsPhone: true },
  techalert:            { fn: "create-hire-alert-checkout", label: "TechAlert", trial: false },
  contractor_leads:     { fn: "create-contractor-checkout", label: "Contractor Leads", trial: false, externalLandingUrl: "/contractor-leads" },
  dead_lead:            { fn: "dead-lead-billing-setup", label: "Dead Lead Reactivation", trial: false, externalLandingUrl: "/dead-lead-intake" },
  trade_radar_roofing:      { fn: "create-trade-radar-checkout", label: "Roofing Radar",      trial: true, vertical: "roofing", needsPhone: true },
  trade_radar_hvac:         { fn: "create-trade-radar-checkout", label: "HVAC Radar",         trial: true, vertical: "hvac", needsPhone: true },
  trade_radar_plumbing:     { fn: "create-trade-radar-checkout", label: "Plumbing Radar",     trial: true, vertical: "plumbing", needsPhone: true },
  trade_radar_electrical:   { fn: "create-trade-radar-checkout", label: "Electrical Radar",   trial: true, vertical: "electrical", needsPhone: true },
  trade_radar_pest_control: { fn: "create-trade-radar-checkout", label: "Pest Control Radar", trial: true, vertical: "pest_control", needsPhone: true },
  trade_radar_gutters:      { fn: "create-trade-radar-checkout", label: "Gutters Radar",      trial: true, vertical: "gutters", needsPhone: true },
  trade_radar_exterior:     { fn: "create-trade-radar-checkout", label: "Exterior Radar",     trial: true, vertical: "exterior", needsPhone: true },
  trade_radar_tree:         { fn: "create-trade-radar-checkout", label: "Tree Radar",         trial: true, vertical: "tree", needsPhone: true },
  trade_radar_restoration:  { fn: "create-trade-radar-checkout", label: "Restoration Radar",  trial: true, vertical: "restoration", needsPhone: true },
  trade_radar_demo_junk:    { fn: "create-trade-radar-checkout", label: "Demo & Junk Radar",  trial: true, vertical: "demo_junk", needsPhone: true },
  trade_radar_foundation:   { fn: "create-trade-radar-checkout", label: "Foundation Radar",   trial: true, vertical: "foundation", needsPhone: true },
};

const START_RADAR_TRIAL_PRODUCTS: Partial<Record<CanonicalKey, string>> = {
  mortgage_radar: "mortgage_radar",
};

const GENERIC_PRODUCT_DEFAULTS: Record<string, CanonicalKey> = {
  trade_radar: "trade_radar_roofing",
};

// Alias map → canonical key. Lowercase keys, hyphens & underscores normalized at lookup.
const ALIASES: Record<string, CanonicalKey> = {
  // FieldDesk
  field_desk: "field_desk",
  fielddesk: "field_desk",
  field_crm: "field_desk",
  field_service: "field_desk",
  // Missed-call
  missed_call_catch: "missed_call_catch",
  missed_call: "missed_call_catch",
  missedcall: "missed_call_catch",
  missed_call_text: "missed_call_catch",
  textback: "missed_call_catch",
  // SiteRadar
  site_radar: "site_radar",
  siteradar: "site_radar",
  // Phone Answering
  phone_answering: "phone_answering",
  ai_phone_answering: "phone_answering",
  ai_phone: "phone_answering",
  // Bundle
  bundle: "bundle_revenue_suite",
  bundle_revenue_suite: "bundle_revenue_suite",
  revenue_suite: "bundle_revenue_suite",
  // TechAlert
  techalert: "techalert",
  hire_alert: "techalert",
  hirealert: "techalert",
  talent_radar: "techalert",
  talentradar: "techalert",
  carealert: "techalert",
  // Contractor leads / dead lead
  contractor_leads: "contractor_leads",
  contractor: "contractor_leads",
  dead_lead: "dead_lead",
  dead_leads: "dead_lead",
  dead_lead_reactivation: "dead_lead",
  // Mortgage Radar
  mortgage_radar: "mortgage_radar",
  mortgageradar: "mortgage_radar",
  // Trade Radar verticals — all spelling variants point to canonical trade_radar_<v>
  trade_radar_roofing: "trade_radar_roofing", roofing_radar: "trade_radar_roofing", roofing: "trade_radar_roofing",
  trade_radar_hvac: "trade_radar_hvac", hvac_radar: "trade_radar_hvac", hvac: "trade_radar_hvac",
  trade_radar_plumbing: "trade_radar_plumbing", plumbing_radar: "trade_radar_plumbing", plumbing: "trade_radar_plumbing",
  trade_radar_electrical: "trade_radar_electrical", electrical_radar: "trade_radar_electrical", electrical: "trade_radar_electrical",
  trade_radar_pest_control: "trade_radar_pest_control", pest_control_radar: "trade_radar_pest_control", pest_control: "trade_radar_pest_control", pest: "trade_radar_pest_control",
  trade_radar_gutters: "trade_radar_gutters", gutters_radar: "trade_radar_gutters", gutters: "trade_radar_gutters",
  trade_radar_exterior: "trade_radar_exterior", exterior_radar: "trade_radar_exterior", exterior: "trade_radar_exterior",
  painting_radar: "trade_radar_exterior", painting: "trade_radar_exterior",
  trade_radar_tree: "trade_radar_tree", tree_radar: "trade_radar_tree", tree: "trade_radar_tree",
  trade_radar_restoration: "trade_radar_restoration", restoration_radar: "trade_radar_restoration", restoration: "trade_radar_restoration",
  trade_radar_demo_junk: "trade_radar_demo_junk", demo_junk_radar: "trade_radar_demo_junk", demo_junk: "trade_radar_demo_junk",
  trade_radar_foundation: "trade_radar_foundation", foundation_radar: "trade_radar_foundation", foundation: "trade_radar_foundation",
};

function normalizeKey(raw: string): ResolvedProductKey | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase().replace(/-/g, "_");
  return ALIASES[k] ?? GENERIC_PRODUCT_DEFAULTS[k] ?? null;
}

export default function StartTrial() {
  const [params] = useSearchParams();
  const rawProduct = params.get("product") || "";
  const canonical = useMemo(() => normalizeKey(rawProduct), [rawProduct]);
  const config = canonical ? PRODUCTS[canonical] : null;

  const [email, setEmail] = useState(params.get("email") || "");
  const [businessName, setBusinessName] = useState(params.get("business") || "");
  const [phone, setPhone] = useState(params.get("phone") || "");
  const [website, setWebsite] = useState(params.get("website") || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = config
      ? `${config.trial ? "Start your 7-day free trial" : "Get started"} · ${config.label}`
      : "Start trial";
  }, [config]);

  // Auto-redirect products that need their full landing page (compliance, territory, etc).
  useEffect(() => {
    if (config?.externalLandingUrl) {
      const url = new URL(config.externalLandingUrl, window.location.origin);
      if (email) url.searchParams.set("email", email);
      if (businessName) url.searchParams.set("business", businessName);
      // Preserve UTM tags
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "rcpt"].forEach((k) => {
        const v = params.get(k);
        if (v) url.searchParams.set(k, v);
      });
      window.location.replace(url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.externalLandingUrl]);

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1628] text-white p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold">We're getting your trial ready</h1>
          <p className="text-white/70">
            One sec — text Matt at <a className="text-[#00d4ff] underline" href="sms:+13139921219">(313) 992-1219</a> or
            email <a className="text-[#00d4ff] underline" href="mailto:matt@detroitwebagent.com">matt@detroitwebagent.com</a> with the product
            you wanted and we'll have you set up in minutes.
          </p>
          {rawProduct && (
            <p className="text-xs text-white/40">ref: {rawProduct}</p>
          )}
        </div>
      </div>
    );
  }

  if (config.externalLandingUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1628] text-white p-6">
        <p className="text-white/70 text-sm">Redirecting…</p>
      </div>
    );
  }

  function buildPayload() {
    const base: Record<string, unknown> = {
      email,
      name: "",
      contact_name: businessName,
      phone,
      city: "",
      website,
      // Different checkout fns expect different cases — send all common variants.
      businessName,
      business_name: businessName,
      company: businessName,
      company_name: businessName,
    };
    if (config!.vertical) {
      base.vertical = config!.vertical;
      base.tcpa_consent = true;
    }
    const radarTrialProduct = canonical ? START_RADAR_TRIAL_PRODUCTS[canonical] : undefined;
    if (radarTrialProduct) {
      base.product = radarTrialProduct;
      base.source = params.get("utm_source") || "start-trial";
    }
    return base;
  }

  async function startCheckout(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await (supabase.functions as any).invoke(config!.fn, {
        body: buildPayload(),
      });
      if (fnError) throw fnError;
      if (data?.magic_url) {
        window.location.href = data.magic_url;
        return;
      }
      const url = data?.url || data?.setup_url || data?.pilot_url;
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error(data?.error || "Checkout did not return a URL.");
    } catch (e: any) {
      setError(e?.message || "Something went wrong starting your trial. Text (313) 992-1219 and we'll fix it now.");
      setBusy(false);
      // Notify Matt so he can manually rescue the lead
      (supabase.functions as any).invoke("notify-matt-trial-fail", {
        body: { product: config?.fn ?? rawProduct, email, error: e?.message ?? "unknown" },
      }).catch(() => {});
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#0d1f3c] text-white">
      <div className="max-w-xl mx-auto p-6 sm:p-10">
        <div className="text-center mb-8">
          <div className="text-[#00d4ff] text-sm font-bold tracking-wider uppercase">{config.label}</div>
          <h1 className="text-3xl sm:text-4xl font-black mt-2">
            {config.trial ? "Start your 7-day free trial" : "Get started"}
          </h1>
          {config.trial && (
            <p className="text-white/70 mt-3">
              No credit card required. Then 50% off your first 3 months.
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
          {config.needsPhone && (
            <label className="block">
              <span className="text-sm text-white/70">Business phone</span>
              <input
                required value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="(313) 555-0123"
                className="w-full mt-1 bg-[#0a1628] border border-white/20 rounded px-3 py-2 text-white"
              />
            </label>
          )}
          {config.needsWebsite && (
            <label className="block">
              <span className="text-sm text-white/70">Website</span>
              <input
                required value={website} onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourcompany.com"
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
