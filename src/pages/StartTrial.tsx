import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackTrialEvent } from "@/lib/trialFunnel";
import StickyTrialCTA from "@/components/trial/StickyTrialCTA";
import TrustSignals from "@/components/trial/TrustSignals";

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
  | "trade_radar_foundation"
  | "investor_radar"
  | "realtor_radar"
  | "solar_radar";

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

// All trial products go through start-radar-trial (no credit card, magic-link login).
// Paid checkouts are reached separately from upgrade CTAs inside dashboards.
const PRODUCTS: Record<CanonicalKey, ProductDef> = {
  mortgage_radar:       { fn: "start-radar-trial", label: "Mortgage Radar", trial: true, needsPhone: true },
  field_desk:           { fn: "start-radar-trial", label: "FieldDesk", trial: true, needsPhone: true },
  site_radar:           { fn: "start-radar-trial", label: "SiteRadar", trial: true, needsWebsite: true },
  missed_call_catch:    { fn: "start-radar-trial", label: "Missed-Call Catch", trial: true, needsPhone: true },
  phone_answering:      { fn: "create-phone-answering-checkout", label: "AI Phone Answering", trial: true, needsPhone: true },
  bundle_revenue_suite: { fn: "start-radar-trial", label: "Revenue Suite Bundle", trial: true, needsPhone: true },
  techalert:            { fn: "start-radar-trial", label: "TechAlert", trial: true, needsPhone: true },
  contractor_leads:     { fn: "start-radar-trial", label: "Contractor Leads", trial: true, needsPhone: true },
  dead_lead:            { fn: "dead-lead-billing-setup", label: "Dead Lead Reactivation", trial: false, externalLandingUrl: "/dead-lead-intake" },
  trade_radar_roofing:      { fn: "start-radar-trial", label: "Roofing Radar",      trial: true, vertical: "roofing", needsPhone: true },
  trade_radar_hvac:         { fn: "start-radar-trial", label: "HVAC Radar",         trial: true, vertical: "hvac", needsPhone: true },
  trade_radar_plumbing:     { fn: "start-radar-trial", label: "Plumbing Radar",     trial: true, vertical: "plumbing", needsPhone: true },
  trade_radar_electrical:   { fn: "start-radar-trial", label: "Electrical Radar",   trial: true, vertical: "electrical", needsPhone: true },
  trade_radar_pest_control: { fn: "start-radar-trial", label: "Pest Control Radar", trial: true, vertical: "pest_control", needsPhone: true },
  trade_radar_gutters:      { fn: "start-radar-trial", label: "Gutters Radar",      trial: true, vertical: "gutters", needsPhone: true },
  trade_radar_exterior:     { fn: "start-radar-trial", label: "Exterior Radar",     trial: true, vertical: "exterior", needsPhone: true },
  trade_radar_tree:         { fn: "start-radar-trial", label: "Tree Radar",         trial: true, vertical: "tree", needsPhone: true },
  trade_radar_restoration:  { fn: "start-radar-trial", label: "Restoration Radar",  trial: true, vertical: "restoration", needsPhone: true },
  trade_radar_demo_junk:    { fn: "start-radar-trial", label: "Demo & Junk Radar",  trial: true, vertical: "demo_junk", needsPhone: true },
  trade_radar_foundation:   { fn: "start-radar-trial", label: "Foundation Radar",   trial: true, vertical: "foundation", needsPhone: true },
  investor_radar:       { fn: "start-radar-trial", label: "Investor Radar", trial: true, needsPhone: true },
  realtor_radar:        { fn: "start-radar-trial", label: "Realtor Radar", trial: true, needsPhone: true },
  solar_radar:          { fn: "start-radar-trial", label: "Solar Installer Radar", trial: true, needsPhone: true },
};

// Map every CanonicalKey → start-radar-trial product slug.
const CANONICAL_TO_TRIAL_PRODUCT: Partial<Record<CanonicalKey, string>> = {
  mortgage_radar: "mortgage_radar",
  field_desk: "fielddesk",
  site_radar: "site_radar",
  missed_call_catch: "missed_call",
  bundle_revenue_suite: "bundle_revenue_suite",
  techalert: "techalert",
  contractor_leads: "contractor_leads",
  trade_radar_roofing: "roofing_radar",
  trade_radar_hvac: "hvac_radar",
  trade_radar_plumbing: "plumbing_radar",
  trade_radar_electrical: "electrical_radar",
  trade_radar_pest_control: "pest_control_radar",
  trade_radar_gutters: "gutters_radar",
  trade_radar_exterior: "exterior_radar",
  trade_radar_tree: "tree_radar",
  trade_radar_restoration: "restoration_radar",
  trade_radar_demo_junk: "demo_junk_radar",
  trade_radar_foundation: "foundation_radar",
  investor_radar: "investor_radar",
  realtor_radar: "realtor_radar",
  solar_radar: "solar_radar",
};

// Per-product pricing & "what happens next" preview block. Shown above the form so
// people aren't filling in 3 fields with zero context. Kept in one place for easy edit.
const PRODUCT_PITCH: Partial<Record<CanonicalKey, { price: string; promise: string; bullets: string[] }>> = {
  mortgage_radar:       { price: "$149/mo after trial", promise: "Refi & purchase intent leads in your inbox within 4 hours of signup.", bullets: ["FCRA/TCPA compliant", "Daily AM digest by 9:30am ET", "Cancel anytime in one click"] },
  field_desk:           { price: "$199/mo after trial", promise: "Live tech GPS, job dispatch, and a customer portal — running by tomorrow morning.", bullets: ["Replaces ServiceTitan / Housecall Pro at 1/4 the price", "Customer SMS confirmations", "CSV export anytime"] },
  site_radar:           { price: "$49/mo after trial",  promise: "Identify the companies visiting your site within 24 hours of installing the script.", bullets: ["1-line install", "Weekly hot-visitor digest", "Slack/email alerts on repeat visits"] },
  missed_call_catch:    { price: "$99/mo after trial",  promise: "Every missed call gets a friendly text-back inside 60 seconds — recover ~27% of dropped revenue.", bullets: ["Voicemail transcribed to text", "Callback reminders to your team", "Works with any number"] },
  phone_answering:      { price: "From $99/mo",         promise: "AI receptionist answers in your brand voice — books jobs, captures leads, escalates urgent calls.", bullets: ["24/7 availability", "Live call transcripts", "Trained on your services"] },
  bundle_revenue_suite: { price: "$299/mo bundle",      promise: "FieldDesk + SiteRadar + Missed-Call Catch in one setup. Save $48/mo vs standalone.", bullets: ["Single onboarding call", "All 3 admin dashboards", "First leads + visitors in 24h"] },
  techalert:            { price: "$149/mo · $79/mo bundled", promise: "Get tipped off when local trades businesses are hiring — perfect for staffing, equipment, software pitches.", bullets: ["8 signal sources", "Daily AM brief", "Owner contact enriched"] },
  trade_radar_roofing:      { price: "$149/mo after trial", promise: "Storm-damage, new-permit, and homeowner-equity leads in your county — daily.", bullets: ["NOAA + BSEED + 40+ public sources", "Score 9 = SMS alert", "Owner phone + Street View included"] },
  trade_radar_hvac:         { price: "$149/mo after trial", promise: "Aging-system, heatwave, and new-homeowner HVAC leads — daily AM digest.", bullets: ["NOAA extreme-temp alerts", "Pre-1990 home targeting", "Owner contact enriched"] },
  trade_radar_plumbing:     { price: "$149/mo after trial", promise: "Major plumbing permits, water-damage signals, and lead-line jobs in your area.", bullets: ["BSEED permit feed", "311 water/sewer complaints", "Score 9 = SMS alert"] },
  trade_radar_electrical:   { price: "$149/mo after trial", promise: "Panel-upgrade permits and aging-electrical-system leads in your county.", bullets: ["BSEED permit feed", "Pre-1960 home targeting", "Owner contact enriched"] },
  trade_radar_pest_control: { price: "$149/mo after trial", promise: "Vacant-property, foreclosure, and overgrown-lot pest leads — daily.", bullets: ["DLBA + blight ticket feed", "Owner contact enriched", "Daily AM digest"] },
  trade_radar_gutters:      { price: "$149/mo after trial", promise: "Storm-damage and new-roof-permit gutter leads in your area.", bullets: ["NOAA storm + BSEED feed", "Owner contact enriched", "Daily AM digest"] },
  trade_radar_exterior:     { price: "$149/mo after trial", promise: "Siding, window, and exterior-paint leads from storms + permits + new homeowners.", bullets: ["NOAA + BSEED + Wayne County deeds", "Owner contact enriched", "Score 9 = SMS alert"] },
  trade_radar_tree:         { price: "$149/mo after trial", promise: "Storm-wind, tree-permit, and 311 tree-down leads — daily AM digest.", bullets: ["NOAA wind + 311 feed", "Owner contact enriched", "Score 9 = SMS alert"] },
  trade_radar_restoration:  { price: "$149/mo after trial", promise: "Fire, water-damage, and FEMA-zone restoration leads in your county.", bullets: ["Detroit Fire Incidents feed", "FEMA disaster overlay", "Owner contact enriched"] },
  trade_radar_demo_junk:    { price: "$149/mo after trial", promise: "Demo permits, estate sales, and probate filings — perfect demo/junk-haul leads.", bullets: ["BSEED demo permit feed", "Estate sale + probate scrapers", "Daily AM digest"] },
  trade_radar_foundation:   { price: "$149/mo after trial", promise: "Heavy-rain, flood, and foundation-permit leads in your county.", bullets: ["NOAA flood + FEMA NFIP", "BSEED foundation permits", "Daily AM digest"] },
  investor_radar:       { price: "$199/mo after trial", promise: "Probate, pre-foreclosure, and tax-delinquent properties — motivated sellers, daily.", bullets: ["Court probate filings + foreclosure feed", "Tax-delinquent property records", "Owner contact enriched"] },
  realtor_radar:        { price: "$149/mo after trial", promise: "FSBO listings + price reductions in your zip codes — listing-conversion leads, daily.", bullets: ["Zillow + Realtor.com FSBO scrape", "Price-reduction alerts", "Owner phone + email enriched"] },
  solar_radar:          { price: "$149/mo after trial", promise: "New homeowners + new-permit homes — solar's highest-converting audience.", bullets: ["Deed transfers <12 months", "BSEED + county permit feeds", "Owner contact enriched"] },
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
  investor_radar: "investor_radar", investor: "investor_radar", wholesaler: "investor_radar", wholesaler_radar: "investor_radar",
  realtor_radar: "realtor_radar", realtor: "realtor_radar", real_estate_agent: "realtor_radar", agent_radar: "realtor_radar",
  solar_radar: "solar_radar", solar: "solar_radar", solar_installer: "solar_radar",
};

function normalizeKey(raw: string): ResolvedProductKey | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase().replace(/-/g, "_");
  return ALIASES[k] ?? GENERIC_PRODUCT_DEFAULTS[k] ?? null;
}

// Curated picker for the no-product fallback. Order = priority on the page.
const PICKER_OPTIONS: { key: CanonicalKey; tagline: string }[] = [
  { key: "missed_call_catch", tagline: "Auto-text every missed call in 60 seconds" },
  { key: "trade_radar_roofing", tagline: "Storm + permit + homeowner leads, daily" },
  { key: "trade_radar_hvac", tagline: "Aging-system + heatwave HVAC leads" },
  { key: "trade_radar_plumbing", tagline: "Major permits + water-damage signals" },
  { key: "field_desk", tagline: "Tech GPS + dispatch + customer SMS" },
  { key: "site_radar", tagline: "Identify companies visiting your site" },
  { key: "mortgage_radar", tagline: "Refi + purchase intent leads, daily" },
  { key: "phone_answering", tagline: "AI receptionist that books jobs 24/7" },
  { key: "bundle_revenue_suite", tagline: "FieldDesk + SiteRadar + Missed-Call" },
];

export default function StartTrial() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
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

  // Funnel: page view (once per canonical product). If no product → fire picker_view too.
  useEffect(() => {
    trackTrialEvent("view", canonical ?? rawProduct ?? null, { email });
    if (!canonical) {
      trackTrialEvent("picker_view", rawProduct || null, { metadata: { ref: rawProduct || "none" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical]);

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
      <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#0d1f3c] text-white">
        <div className="max-w-3xl mx-auto p-6 sm:p-10">
          <div className="text-center mb-8">
            <div className="text-[#00d4ff] text-sm font-bold tracking-wider uppercase">Detroit Web Agency</div>
            <h1 className="text-3xl sm:text-4xl font-black mt-2">Pick a product to start your free trial</h1>
            <p className="text-white/70 mt-3">7 days free · no credit card · cancel in one click</p>
          </div>
          <TrustSignals />
          <div className="grid sm:grid-cols-2 gap-3">
            {PICKER_OPTIONS.map((opt) => {
              const def = PRODUCTS[opt.key];
              const pitch = PRODUCT_PITCH[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    trackTrialEvent("picker_select", opt.key, { metadata: { from: "picker" } });
                    const next = new URLSearchParams(params);
                    next.set("product", opt.key);
                    navigate(`/start-trial?${next.toString()}`, { replace: true });
                  }}
                  className="text-left bg-[#0a1628]/60 hover:bg-[#0a1628] border border-[#00d4ff]/30 hover:border-[#00d4ff] rounded-xl p-4 transition"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-bold text-white">{def.label}</div>
                    {pitch && <div className="text-xs text-[#00d4ff] font-semibold whitespace-nowrap">{pitch.price}</div>}
                  </div>
                  <div className="text-sm text-white/70 mt-1">{opt.tagline}</div>
                  <div className="text-xs text-[#00d4ff] mt-2 font-bold">Start free trial →</div>
                </button>
              );
            })}
          </div>
          <div className="text-center text-xs text-white/50 mt-6">
            Don't see what you want? Text Matt at{" "}
            <a className="text-[#00d4ff] underline font-bold" href="sms:+13139921219">(313) 992-1219</a>
            {rawProduct && <span className="block mt-1 text-white/30">ref: {rawProduct}</span>}
          </div>
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
    // Smart fallback for business name so leaving it blank doesn't break checkout.
    const emailLocal = (email.split("@")[0] || "").replace(/[._-]/g, " ").trim();
    const productLabel = config?.label || "your business";
    const effectiveBusiness =
      businessName.trim() || (emailLocal ? `${emailLocal}'s ${productLabel}` : productLabel);
    const base: Record<string, unknown> = {
      email,
      name: "",
      contact_name: effectiveBusiness,
      phone,
      city: "",
      website,
      businessName: effectiveBusiness,
      business_name: effectiveBusiness,
      company: effectiveBusiness,
      company_name: effectiveBusiness,
    };
    if (config!.vertical) {
      base.vertical = config!.vertical;
      base.tcpa_consent = true;
    }
    const radarTrialProduct = canonical ? CANONICAL_TO_TRIAL_PRODUCT[canonical] : undefined;
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
    const productKey = canonical ?? rawProduct ?? null;
    trackTrialEvent("form_submit", productKey, { email });
    try {
      const { data, error: fnError } = await (supabase.functions as any).invoke(config!.fn, {
        body: buildPayload(),
      });
      if (fnError) throw fnError;
      if (data?.magic_url) {
        trackTrialEvent("trial_success", productKey, { email, metadata: { via: "magic_url" } });
        window.location.href = data.magic_url;
        return;
      }
      const url = data?.url || data?.setup_url || data?.pilot_url;
      if (url) {
        trackTrialEvent("checkout_redirect", productKey, { email, metadata: { via: "checkout_url" } });
        window.location.href = url;
        return;
      }
      throw new Error(data?.error || "Checkout did not return a URL.");
    } catch (e: any) {
      const msg = e?.message || "Something went wrong starting your trial. Text (313) 992-1219 and we'll fix it now.";
      setError(msg);
      setBusy(false);
      trackTrialEvent("trial_error", productKey, { email, metadata: { error: msg } });
      // Notify Matt so he can manually rescue the lead
      (supabase.functions as any).invoke("notify-matt-trial-fail", {
        body: { product: config?.fn ?? rawProduct, email, error: e?.message ?? "unknown" },
      }).catch(() => {});
    }
  }

  const pitch = canonical ? PRODUCT_PITCH[canonical] : undefined;
  const [focusFired, setFocusFired] = useState(false);
  const [emailLocked, setEmailLocked] = useState(false);
  const handleFocus = () => {
    if (focusFired) return;
    setFocusFired(true);
    trackTrialEvent("form_focus", canonical ?? rawProduct ?? null, { email });
  };
  const saveSpot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setEmailLocked(true);
    trackTrialEvent("save_spot", canonical ?? rawProduct ?? null, { email });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#0d1f3c] text-white">
      <div className="max-w-xl mx-auto p-6 sm:p-10">
        <div className="text-center mb-6">
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

        {pitch && (
          <div className="mb-6 bg-[#00d4ff]/10 border border-[#00d4ff]/40 rounded-xl p-5">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-xs uppercase tracking-wider text-[#00d4ff] font-bold">What you get</span>
              <span className="text-sm font-bold text-white">{pitch.price}</span>
            </div>
            <p className="text-white text-base font-semibold mb-3">{pitch.promise}</p>
            <ul className="space-y-1.5">
              {pitch.bullets.map((b) => (
                <li key={b} className="text-sm text-white/80 flex gap-2">
                  <span className="text-[#00d4ff]">✓</span><span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form id="trial-form" onSubmit={emailLocked ? startCheckout : saveSpot} className="bg-[#0a1628]/60 border border-[#00d4ff]/30 rounded-xl p-6 space-y-4 pb-24 md:pb-6">
          <label className="block">
            <span className="text-sm text-white/70">Work email</span>
            <input
              required type="email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={handleFocus}
              readOnly={emailLocked}
              className="w-full mt-1 bg-[#0a1628] border border-white/20 rounded px-3 py-2 text-white"
            />
            {emailLocked && (
              <button type="button" onClick={() => setEmailLocked(false)} className="text-xs text-[#00d4ff] underline mt-1">
                change email
              </button>
            )}
          </label>

          {!emailLocked && (
            <>
              <button
                type="submit"
                className="w-full bg-[#00d4ff] text-[#0a1628] font-bold py-3 rounded text-base"
              >
                Save my spot →
              </button>
              <p className="text-[11px] text-white/50 text-center">
                We'll hold your trial for 24 hours. One more step after this.
              </p>
            </>
          )}

          {emailLocked && (
            <>
              <label className="block">
                <span className="text-sm text-white/70">Business name <span className="text-white/40 font-normal">(optional)</span></span>
                <input
                  value={businessName} onChange={(e) => setBusinessName(e.target.value)} onFocus={handleFocus}
                  placeholder="We'll fill it in if you skip"
                  className="w-full mt-1 bg-[#0a1628] border border-white/20 rounded px-3 py-2 text-white"
                />
              </label>
              {config.needsPhone && (
                <label className="block">
                  <span className="text-sm text-white/70">Business phone <span className="text-white/40 font-normal">(optional · for SMS lead alerts)</span></span>
                  <input
                    type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onFocus={handleFocus}
                    placeholder="(313) 555-0123"
                    className="w-full mt-1 bg-[#0a1628] border border-white/20 rounded px-3 py-2 text-white"
                  />
                </label>
              )}
              {config.needsWebsite && (
                <label className="block">
                  <span className="text-sm text-white/70">
                    Website {canonical === "site_radar" ? <span className="text-white/40 font-normal">(skip if you don't have one — we'll text you to set up)</span> : null}
                  </span>
                  <input
                    required={canonical !== "site_radar"}
                    value={website} onChange={(e) => setWebsite(e.target.value)} onFocus={handleFocus}
                    placeholder="https://yourcompany.com"
                    className="w-full mt-1 bg-[#0a1628] border border-white/20 rounded px-3 py-2 text-white"
                  />
                  {canonical === "site_radar" && (
                    <p className="text-[11px] text-white/50 mt-1">
                      No website yet? Text Matt at <a className="text-[#00d4ff] underline" href="sms:+13139921219">(313) 992-1219</a> — he'll get you set up in 10 minutes.
                    </p>
                  )}
                </label>
              )}
              {error && (
                <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 space-y-2">
                  <div className="text-red-300 text-sm font-semibold">Something went sideways: {error}</div>
                  <div className="text-xs text-white/70">
                    Text Matt directly — he'll get you set up in minutes:{" "}
                    <a className="text-[#00d4ff] underline font-bold" href="sms:+13139921219">(313) 992-1219</a>{" "}
                    · or email{" "}
                    <a className="text-[#00d4ff] underline" href={`mailto:matt@detroitwebagent.com?subject=Trial%20signup%20issue%20-%20${encodeURIComponent(config.label)}&body=My%20email%3A%20${encodeURIComponent(email)}%0AError%3A%20${encodeURIComponent(error)}`}>matt@detroitwebagent.com</a>
                  </div>
                </div>
              )}
              <button
                type="submit" disabled={busy}
                className="w-full bg-[#00d4ff] text-[#0a1628] font-bold py-3 rounded text-base disabled:opacity-50"
              >
                {busy ? "Starting…" : (config.trial ? "Start 7-day free trial" : "Continue")}
              </button>
              <div className="text-center text-xs text-white/60 pt-1">
                Prefer to talk first? Text Matt:{" "}
                <a href="sms:+13139921219" className="text-[#00d4ff] font-bold underline">(313) 992-1219</a>
              </div>
              <p className="text-[10px] text-white/40 text-center">
                By continuing you agree to our terms. Questions? <a href="mailto:matt@detroitwebagent.com" className="text-[#00d4ff]">matt@detroitwebagent.com</a>.
              </p>
            </>
          )}
        </form>
      </div>
      <StickyTrialCTA
        label={!emailLocked ? "Save my spot →" : (config.trial ? "Start 7-day free trial →" : "Continue →")}
        targetFormId="trial-form"
      />
    </div>
  );
}

