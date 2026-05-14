// Trade Radar daily scanner — 10 trade verticals.
// POST { vertical?: "roofing"|"hvac"|"plumbing"|"electrical"|"pest_control"|"gutters"|"exterior"|"tree"|"restoration"|"demo_junk"|"foundation"|"all" }

import { createClient } from "npm:@supabase/supabase-js@2";
import { validateLead, quarantineRaw } from "../_shared/anti-hallucination.ts";
import { runEmailWaterfall } from "../_shared/email-waterfall.ts";
import { sendSMS } from "../_shared/twilio.ts";
import { dwaEmail, dwaWrap } from "../_shared/dwa-email.ts";
import { deliverCrmWebhook } from "../_shared/crm-webhook.ts";
import { scanSignals as scanRoofing } from "../_shared/trade-signals/signals-roofing.ts";
import { scanSignals as scanHvac } from "../_shared/trade-signals/signals-hvac.ts";
import { scanSignals as scanPlumbing } from "../_shared/trade-signals/signals-plumbing.ts";
import { scanSignals as scanElectrical } from "../_shared/trade-signals/signals-electrical.ts";
import { scanSignals as scanPestControl } from "../_shared/trade-signals/signals-pest_control.ts";
import { scanSignals as scanGutters } from "../_shared/trade-signals/signals-gutters.ts";
import { scanSignals as scanExterior } from "../_shared/trade-signals/signals-painting.ts";
import { scanSignals as scanTree } from "../_shared/trade-signals/signals-tree.ts";
import { scanSignals as scanRestoration } from "../_shared/trade-signals/signals-restoration.ts";
import { scanSignals as scanDemoJunk } from "../_shared/trade-signals/signals-demo_junk.ts";
import { scanSignals as scanFoundation } from "../_shared/trade-signals/signals-foundation.ts";
import { fetchFreshBusinessSignals, fetchMortgageSignals, fetchHireSignals } from "../_shared/signal-waterfall.ts";
import { scrapeZillowFSBO, scrapeEstateSales } from "../_shared/scrapers-public-listings.ts";
import { runFederalAreaSignals } from "../_shared/federal-area-signals.ts";
import { runMetroPermitSignals } from "../_shared/metro-permits.ts";
import { runCountyDeedSignals } from "../_shared/county-deeds.ts";
import { runPacerBankruptcySignals } from "../_shared/pacer-bankruptcy.ts";

// Warn loudly at startup if FIRECRAWL_API_KEY is missing — half the per-address
// signal sources (FSBO, estate sales, probate, foreclosure) depend on it.
if (!Deno.env.get("FIRECRAWL_API_KEY")) {
  console.error("[trade-scanner] CRITICAL: FIRECRAWL_API_KEY not set — FSBO, estate sale, probate, foreclosure scrapers will return empty. Add this secret to Supabase Edge Function secrets.");
}

// Signal types that describe an AREA (county/zip/state), not a single street address.
// These bypass the per-address validator and are written to trade_radar_area_signals.
const AREA_ALERT_TYPES = new Set<string>([
  "hail_damage_area", "storm_wind_damage", "fema_disaster", "fema_gutter_damage",
  "new_homeowner_roof", "lead_line_area", "extreme_weather_hvac", "nfip_flood_hvac",
  "storm_panel_check", "storm_gutter_damage", "registry_signal",
  // New verticals
  "tree_hazard_area", "storm_tree_damage",
  "flood_warning", "heavy_rain_event", "fire_incident_area", "water_damage_area", "mold_risk_zone",
  "heavy_rain_foundation", "fema_flood_foundation", "foundation_flood_risk", "nfip_foundation",
  "storm_siding_damage",
  // Phase 33 new sources
  "homeowner_equity_area", "home_improvement_loan_area", "aging_panel_area",
  // Phase 33 batch 3
  "historical_hail_county", "storm_tree_damage_area",
  // CourtListener foreclosure filings — case names not street addresses
  "courtlistener_foreclosure",
  // Wave 1 Batch 1C — federal area signals
  "aging_housing_tract", "epa_water_violation_area", "nfip_repeat_loss_zip",
  // Wave 1 Batch 1F — PACER bankruptcy court distress
  "bankruptcy_distress",
]);

// Verticals where home turnover (FSBO listing, estate sale) is a high-quality
// per-address inspection/install opportunity.
const HOME_TURNOVER_VERTICALS = new Set<string>([
  "roofing", "hvac", "plumbing", "gutters", "exterior", "pest_control", "electrical", "demo_junk",
]);

// Suggested openers/scores by vertical for FSBO + estate-sale leads.
const TURNOVER_SCORE = 6;
function turnoverOpener(vertical: string, signalType: string, address: string): string {
  const isFSBO = signalType === "fsbo_listing";
  const verb = isFSBO ? "you're selling" : "your family is going through an estate sale";
  const askMap: Record<string, string> = {
    roofing: "a quick free roof inspection could add $5-15k to the sale price",
    hvac: "a free HVAC tune-up gives buyers peace of mind and helps the appraisal",
    plumbing: "a free plumbing walkthrough catches issues before the buyer's inspector does",
    gutters: "clean gutters and downspouts make a huge curb-appeal difference for showings",
    exterior: "a fresh exterior paint and siding check could add real ROI before listing photos",
    pest_control: "a free pest inspection keeps closing on track if any treatment is needed",
    electrical: "a quick free electrical safety check catches anything that would flag in inspection",
    demo_junk: "most families need a full cleanout crew the day after the sale — we can have a truck there in 24 hours",
  };
  const ask = askMap[vertical] ?? "we can offer a complimentary inspection";
  return `Hi — saw ${verb} at ${address}. ${ask}. Want me to swing by this week?`;
}

// NAICS code per vertical (used to filter registry-driven signals)
const VERTICAL_NAICS: Record<string, string> = {
  roofing: "238160",
  hvac: "238220",
  plumbing: "238220",
  electrical: "238210",
  pest_control: "561710",
  gutters: "238160",
  exterior: "238320",
  tree: "561730",
  restoration: "238390",
  demo_junk: "238910",
  foundation: "238110",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE_NUMBER") || "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";

const ALL_VERTICALS = [
  "roofing", "hvac", "plumbing", "electrical", "pest_control", "gutters",
  "exterior", "tree", "restoration", "demo_junk", "foundation",
] as const;
type Vertical = typeof ALL_VERTICALS[number];

// County → region map (verbatim from mortgage scanner)
const COUNTY_TO_REGION: Record<string, string> = {
  Wayne: "Southeast Michigan", Oakland: "Southeast Michigan", Macomb: "Southeast Michigan",
  Washtenaw: "Southeast Michigan", Monroe: "Southeast Michigan", Livingston: "Southeast Michigan",
  "St. Clair": "Southeast Michigan", Lenawee: "Southeast Michigan",
  Kent: "West Michigan", Ottawa: "West Michigan", Kalamazoo: "West Michigan",
  Muskegon: "West Michigan", Allegan: "West Michigan",
  Ingham: "Mid-Michigan", Eaton: "Mid-Michigan", Genesee: "Mid-Michigan",
  Saginaw: "Mid-Michigan", Bay: "Mid-Michigan",
  "Grand Traverse": "Northern Michigan", Emmet: "Northern Michigan",
  Lapeer: "East Michigan", Tuscola: "East Michigan", Sanilac: "East Michigan",
  Marquette: "Upper Peninsula", Chippewa: "Upper Peninsula", Delta: "Upper Peninsula",
};

function inferCounty(city?: string): string | undefined {
  if (!city) return undefined;
  const c = city.toLowerCase().trim();
  if (/\b(detroit|dearborn|livonia|westland|taylor|southgate|wyandotte|trenton|hamtramck|highland park|redford|canton|plymouth|grosse pointe)\b/.test(c)) return "Wayne";
  if (/\b(troy|royal oak|birmingham|bloomfield|pontiac|southfield|farmington|novi|ferndale|auburn hills|rochester|waterford|west bloomfield|clarkston)\b/.test(c)) return "Oakland";
  if (/\b(sterling heights|warren|clinton township|mount clemens|utica|shelby township|chesterfield|eastpointe|roseville|st clair shores|fraser)\b/.test(c)) return "Macomb";
  if (/\b(ann arbor|ypsilanti|saline|chelsea|dexter)\b/.test(c)) return "Washtenaw";
  if (/\b(grand rapids|kentwood|wyoming|walker|grandville)\b/.test(c)) return "Kent";
  if (/\b(lansing|east lansing|meridian|okemos|holt)\b/.test(c)) return "Ingham";
  if (/\b(flint|burton|grand blanc|flushing|davison)\b/.test(c)) return "Genesee";
  return undefined;
}

function inferRegion(county?: string): string | undefined {
  if (!county) return undefined;
  return COUNTY_TO_REGION[county];
}

async function upsertWithDedup(
  sb: ReturnType<typeof createClient>,
  vertical: Vertical,
  signal: any,
): Promise<"inserted" | "updated" | "quarantined" | "skipped" | "area"> {
  // Route AREA-level signals (NOAA/FEMA/HMDA/registry) to trade_radar_area_signals
  // INSTEAD of the per-address validator. This is the bug fix — these used to be
  // 100% skipped because their "address" field is actually a county/state name.
  if (signal && typeof signal.signal_type === "string" && AREA_ALERT_TYPES.has(signal.signal_type)) {
    const inferred = inferCounty(signal.city);
    const scope = signal.zip ? "zip" : inferred ? "county" : "state";
    const scope_value = signal.zip || inferred || signal.city || "MI";
    try {
      await sb.from("trade_radar_area_signals").upsert({
        vertical,
        scope,
        scope_value,
        alert_type: signal.signal_type,
        alert_detail: signal.signal_detail ?? null,
        source: signal.source_method ?? "unknown",
        source_url: signal.signal_url ?? null,
        signal_date: signal.signal_date ?? new Date().toISOString().slice(0, 10),
        raw_data: signal.raw_source_data ?? null,
      }, { onConflict: "vertical,scope,scope_value,alert_type,signal_date", ignoreDuplicates: true });
      return "area";
    } catch (e) {
      console.warn(`[trade-scanner] area upsert failed (${vertical}):`, e instanceof Error ? e.message : String(e));
      return "skipped";
    }
  }

  // LLM score cap — same rule as mortgage scanner
  const rawScore = signal.score ?? 5;
  const score = signal.source_method === "llm_search" ? Math.min(3, rawScore) : rawScore;

  // Guard: skip any signal that has no address — registry/waterfall sometimes
  // returns business-only or zip-only rows that can't be geocoded.
  if (!signal || typeof signal.address !== "string" || !signal.address.trim()) {
    return "skipped";
  }

  // Anti-hallucination gate
  let validation;
  try {
    validation = await validateLead(sb, {
      address: signal.address,
      city: signal.city,
      zip: signal.zip,
      state: "MI",
      signal_url: signal.signal_url,
      signal_detail: signal.signal_detail,
    }, { sourceMethod: signal.source_method === "llm_search" ? "llm_search" : "scraper" });
  } catch (e) {
    console.warn(`[trade-scanner] validateLead threw for ${vertical}:`, e instanceof Error ? e.message : String(e));
    return "skipped";
  }

  if (!validation.pass) {
    await quarantineRaw(
      sb, signal,
      validation.reject_code ?? "validation_failed",
      validation.reject_reason ?? "validation_failed",
      signal.source_method ?? "unknown",
    );
    return "quarantined";
  }

  const county = inferCounty(signal.city);
  const region = inferRegion(county);

  // Check for existing lead (address+zip+vertical)
  const { data: existing } = await sb
    .from("trade_radar_leads")
    .select("id, score, signal_count")
    .eq("vertical", vertical)
    .eq("address", signal.address ?? "")
    .eq("zip", signal.zip ?? "")
    .maybeSingle();

  if (existing) {
    await sb.from("trade_radar_leads").update({
      score: Math.min(10, existing.score + 1),
      signal_count: (existing.signal_count ?? 1) + 1,
      last_signal_at: new Date().toISOString(),
      signal_detail: signal.signal_detail,
      signal_type: signal.signal_type,
    }).eq("id", existing.id);
    return "updated";
  }

  const { data: insertedRow, error } = await sb.from("trade_radar_leads").insert({
    vertical,
    address: validation.formatted ?? signal.address,
    city: signal.city,
    zip: signal.zip,
    lat: validation.lat,
    lon: validation.lon,
    county,
    region,
    signal_type: signal.signal_type,
    signal_detail: signal.signal_detail,
    signal_date: signal.signal_date,
    score,
    suggested_opener: signal.suggested_opener,
    best_call_window: signal.best_call_window,
    estimated_value: signal.estimated_value,
    source_method: signal.source_method,
    raw_source_data: signal.raw_source_data,
    // street_view_url removed: previously baked the API key into the row and
    // billed every page view. UI now links to free Google Maps instead.
    street_view_url: null,
    status: "new",
    signal_count: 1,
    last_signal_at: new Date().toISOString(),
  }).select("id").maybeSingle();

  if (error) {
    if (error.code === "23505") return "skipped"; // unique conflict — already exists
    console.error(`[trade-scanner] insert error (${vertical}):`, error.message);
    return "skipped";
  }

  // Enrichment waterfall (gated on score ≥ 7 to control spend) — fire-and-forget
  if (insertedRow?.id && score >= 7) {
    enrichLeadAsync(sb, insertedRow.id, signal).catch((e) =>
      console.warn(`[trade-scanner] enrichment failed for ${insertedRow.id}:`, e instanceof Error ? e.message : String(e))
    );
  }

  return "inserted";
}

async function enrichLeadAsync(
  sb: ReturnType<typeof createClient>,
  leadId: string,
  signal: any,
): Promise<void> {
  const fullName = signal.full_name || signal.owner_name || "";
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ");
  const result = await runEmailWaterfall(sb as any, {
    business_name: signal.full_name || null,
    city: signal.city || null,
    state: "MI",
    contact_first_name: firstName || null,
    contact_last_name: lastName || null,
  });
  await sb.from("trade_radar_leads").update({
    owner_email: result.email,
    owner_name: fullName || null,
    enriched_at: new Date().toISOString(),
    enrichment_meta: { enrichment_trace: result.trace, source: result.source, confidence: result.confidence } as any,
  }).eq("id", leadId);
}

async function notifyClients(
  sb: ReturnType<typeof createClient>,
  vertical: Vertical,
  leads: any[],
): Promise<void> {
  const { data: clients } = await sb
    .from("trade_radar_clients")
    .select("id, email, contact_name, business_name, phone, zip_codes, crm_webhook_url, crm_webhook_secret")
    .eq("vertical", vertical)
    .eq("active", true);

  if (!clients?.length) return;

  // Pull last-7-day Market Intel (area signals) for this vertical so we can
  // surface NOAA/FEMA/HMDA alerts even when per-address leads are zero.
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const { data: areaSignals } = await sb
    .from("trade_radar_area_signals")
    .select("scope, scope_value, alert_type, alert_detail, source, source_url, signal_date")
    .eq("vertical", vertical)
    .gte("signal_date", since7d)
    .order("signal_date", { ascending: false })
    .limit(50);
  const allArea = (areaSignals as any[]) ?? [];

  const VERTICAL_LABELS: Record<string, string> = {
    roofing: "Roofing", hvac: "HVAC", plumbing: "Plumbing",
    electrical: "Electrical", pest_control: "Pest Control",
    gutters: "Gutters", exterior: "Exterior (Painting/Siding/Windows)",
    tree: "Tree Service", restoration: "Water/Fire/Mold Restoration",
    demo_junk: "Demo & Junk Removal", foundation: "Foundation Repair",
  };
  const label = VERTICAL_LABELS[vertical] ?? vertical;

  for (const client of clients) {
    const clientZips = new Set<string>(client.zip_codes ?? []);
    const filtered = clientZips.size
      ? leads.filter((l) => !l.zip || clientZips.has(l.zip))
      : leads;
    const top5 = filtered.slice(0, 5);

    // Filter area intel by client zip when scope=zip; always include
    // county/state-scope alerts (broader signals).
    const clientArea = clientZips.size
      ? allArea.filter((a) => a.scope !== "zip" || clientZips.has(a.scope_value))
      : allArea;
    const topArea = clientArea.slice(0, 3);

    if (!top5.length && !topArea.length) continue;

    const name = client.contact_name || client.business_name || "there";
    const top = top5[0];

    const cards = top5.map((l: any) => {
      const scoreColor = l.score >= 9 ? "#00d4ff" : l.score >= 7 ? "#fbbf24" : "#94a3b8";
      const sig = (l.signal_type ?? "").replace(/_/g, " ");
      const addr = [l.address, l.city, l.zip].filter(Boolean).join(", ");
      const searchQ = l.address
        ? encodeURIComponent(`${l.address} ${l.city ?? ""} owner contact`)
        : encodeURIComponent(`${l.city ?? ""} ${label} lead`);
      const raw = (l.raw_source_data ?? {}) as Record<string, any>;
      const sourceUrl: string | undefined = raw.source_url ?? raw.url ?? raw.listing_url;
      const confidence = typeof l.score === "number" ? `${Math.min(100, l.score * 10)}%` : "—";
      const sourceLabel = l.source_method ?? raw.source ?? "internal";
      return `<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:${scoreColor};font-size:22px;font-weight:700;">${l.score ?? "?"}/10</span>
          <span style="color:#64748b;font-size:11px;text-transform:uppercase;">${sig}</span>
        </div>
        <p style="color:#f1f5f9;font-weight:600;margin:8px 0 4px;">📍 ${addr || "Address pending"}</p>
        ${l.signal_detail ? `<p style="color:#cbd5e1;font-size:12px;margin:4px 0;"><strong style="color:#94a3b8;">Why:</strong> ${l.signal_detail}</p>` : ""}
        <p style="color:#94a3b8;font-size:11px;margin:4px 0;"><strong>Source:</strong> ${sourceLabel} · <strong>Confidence:</strong> ${confidence}${l.signal_date ? ` · <strong>Detected:</strong> ${l.signal_date}` : ""}</p>
        ${sourceUrl ? `<p style="margin:4px 0;"><a href="${sourceUrl}" style="color:#00d4ff;font-size:11px;text-decoration:underline;">🔗 View source listing</a></p>` : ""}
        ${l.suggested_opener ? `<p style="color:#e2e8f0;font-size:12px;font-style:italic;margin:8px 0;">"${l.suggested_opener}"</p>` : ""}
        <a href="https://www.google.com/search?q=${searchQ}" style="display:inline-block;margin-top:8px;padding:6px 12px;background:#0f172a;color:#00d4ff;border:1px solid #00d4ff;border-radius:4px;font-size:11px;text-decoration:none;">🔍 Find Contact</a>
      </div>`;
    }).join("\n");

    const areaHtml = topArea.length ? `
      <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px;margin-bottom:16px;">
        <p style="color:#fbbf24;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 8px;">⚠️ Market Intel — last 7 days</p>
        ${topArea.map((a) => `
          <div style="border-top:1px solid #1e293b;padding:8px 0;">
            <div><span style="color:#e2e8f0;font-size:12px;font-weight:600;">${(a.alert_type ?? "").replace(/_/g, " ")}</span>
            <span style="color:#64748b;font-size:11px;"> · ${a.scope}: ${a.scope_value}</span></div>
            ${a.alert_detail ? `<div style="color:#94a3b8;font-size:11px;margin-top:2px;"><strong style="color:#cbd5e1;">Why:</strong> ${a.alert_detail}</div>` : ""}
            <div style="color:#64748b;font-size:10px;margin-top:2px;"><strong>Source:</strong> ${a.source ?? "—"} · <strong>Date:</strong> ${a.signal_date ?? "—"}${a.source_url ? ` · <a href="${a.source_url}" style="color:#00d4ff;text-decoration:underline;">view</a>` : ""}</div>
          </div>
        `).join("")}
      </div>` : "";

    const headlineLeads = top5.length;
    const innerHtml = `
      <h2 style="color:#00d4ff;font-size:18px;margin:0 0 8px;">${label} Radar — ${headlineLeads ? `${headlineLeads} new lead${headlineLeads > 1 ? "s" : ""}` : "Market Intel"} today</h2>
      <p style="color:#94a3b8;margin:0 0 20px;">Hi ${name}, here are today's top ${label.toLowerCase()} signals in your market.</p>
      ${areaHtml}
      ${cards || `<p style="color:#94a3b8;font-size:13px;">No new per-address signals matched your ZIPs today — scanning continues. Market intel above shows broader trends to help you target outreach.</p>`}
      <p style="color:#64748b;font-size:11px;margin-top:16px;">${leads.length} per-address scan · ${allArea.length} area alerts · ${label} Radar by Detroit Web Agency</p>`;

    const subject = headlineLeads
      ? `🏠 ${headlineLeads} new ${label.toLowerCase()} lead${headlineLeads > 1 ? "s" : ""} in your ZIPs — top score ${top.score ?? "?"}/10`
      : `📊 ${label} Market Intel — ${topArea.length} alert${topArea.length > 1 ? "s" : ""} in your area`;

    await dwaEmail({
      to: client.email,
      subject,
      html: dwaWrap(innerHtml),
    });

    // E3: Mark first lead delivered for trial clients
    if (top5.length > 0) {
      sb.from("trial_signups").update({ first_lead_delivered_at: new Date().toISOString(), sla_status: "green" })
        .eq("email", client.email).eq("status", "active").is("first_lead_delivered_at", null)
        .then(() => {}).catch(() => {});
    }

    // CRM webhook fan-out (Salesforce, Jobber, Zapier, n8n, etc.) — fire-and-forget per lead
    if (client.crm_webhook_url && top5.length) {
      for (const lead of top5) {
        deliverCrmWebhook({
          product: `trade_radar:${vertical}`,
          client_id: client.id,
          url: client.crm_webhook_url,
          secret: client.crm_webhook_secret,
          payload: { lead },
        }).catch(() => { /* logged inside */ });
      }
    }

    if (client.phone && top && top.score >= 9) {
      await sendSMS(
        client.phone,
        TWILIO_FROM,
        `🏠 ${label} Radar: ${headlineLeads} new leads today. Top score: ${top.score}/10 — ${top.city ?? "your area"}. Check your email. — Detroit Web Agency`,
        "trade_radar",
      ).catch((e) => console.warn(`[trade-scanner] hot-lead SMS failed:`, e instanceof Error ? e.message : String(e)));
    }
  }
}

const SCANNERS: Record<Vertical, (state: string, zips?: string[], sb?: any) => Promise<any[]>> = {
  roofing: scanRoofing,
  hvac: scanHvac,
  plumbing: scanPlumbing,
  electrical: scanElectrical,
  pest_control: scanPestControl,
  gutters: scanGutters,
  exterior: scanExterior,
  tree: scanTree,
  restoration: scanRestoration,
  demo_junk: scanDemoJunk,
  foundation: scanFoundation,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "supabase env missing" }), { status: 500 });
  }

  let body: { vertical?: string; state?: string; initial?: boolean } = {};
  try { body = await req.json(); } catch { /* default */ }

  const requestedVertical = body.vertical ?? "all";
  const state = body.state ?? "MI";
  const verticals: Vertical[] = requestedVertical === "all"
    ? [...ALL_VERTICALS]
    : ALL_VERTICALS.includes(requestedVertical as Vertical)
      ? [requestedVertical as Vertical]
      : [];

  if (!verticals.length) {
    return new Response(JSON.stringify({ error: `Unknown vertical: ${requestedVertical}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const summary: Record<string, { inserted: number; updated: number; quarantined: number; skipped: number; notified: number }> = {};

  for (const vertical of verticals) {
    const stats = { inserted: 0, updated: 0, quarantined: 0, skipped: 0, area: 0, notified: 0 };
    summary[vertical] = stats;

    // Right-size: skip this vertical if we already have enough fresh inventory
    // for the current customer count. Override with body.initial=true.
    if (!body.initial) {
      try {
        const { shouldScanMore } = await import("../_shared/intake-throttle.ts");
        const gate = await shouldScanMore(sb, "trade_radar", { vertical });
        if (gate.skip) {
          (stats as any).skip_reason = gate.reason;
          (stats as any).fresh = gate.fresh;
          (stats as any).target = gate.target;
          continue;
        }
      } catch (e) { /* throttle failure must never block scanning */ }
    }

    try {
      const rawSignals = await SCANNERS[vertical](state, undefined, sb);

      // Plug in proven address-yielding scrapers (Zillow FSBO + EstateSales).
      // Same scrapers powering 21 leads/day for mortgage radar. Home turnover
      // = inspection/install opportunity for every trade vertical.
      if (HOME_TURNOVER_VERTICALS.has(vertical)) {
        try {
          const [fsbo, estates] = await Promise.all([
            scrapeZillowFSBO({ perCityCap: 5 }).catch(() => []),
            scrapeEstateSales({ perCityCap: 4 }).catch(() => []),
          ]);
          for (const s of [...fsbo, ...estates]) {
            rawSignals.push({
              address: s.address,
              city: s.city,
              zip: s.zip,
              signal_type: s.signal_type,
              signal_detail: s.signal_detail,
              signal_date: s.signal_date,
              score: TURNOVER_SCORE,
              source_method: "scraper",
              suggested_opener: turnoverOpener(vertical, s.signal_type, s.address),
              best_call_window: "Within 7 days of listing",
              estimated_value: 5000,
              raw_source_data: { source: s.signal_source, url: s.signal_url },
            });
          }
        } catch (e) {
          console.warn(`[trade-scanner] ${vertical} turnover scrape failed:`, e instanceof Error ? e.message : String(e));
        }
      }

      try {
        const naics = VERTICAL_NAICS[vertical] || "238220";
        const MORTGAGE_WATERFALL_VERTICALS = ["roofing", "gutters", "exterior", "pest_control", "hvac", "plumbing", "foundation", "restoration"];
        const HIRE_WATERFALL_VERTICALS = ["electrical"];
        const [biz, env] = await Promise.all([
          fetchFreshBusinessSignals(sb, { state, naics }).catch(() => []),
          MORTGAGE_WATERFALL_VERTICALS.includes(vertical)
            ? fetchMortgageSignals(sb, { state, days: 14 }).catch(() => [])
            : HIRE_WATERFALL_VERTICALS.includes(vertical)
              ? fetchHireSignals(sb, { state, naics }).catch(() => [])
              : Promise.resolve([]),
        ]);
        for (const s of [...(biz || []), ...(env || [])].slice(0, 100)) {
          const a = s as any;
          rawSignals.push({
            address: a.address,
            city: a.city,
            zip: a.zip,
            signal_type: a.type || "registry_signal",
            signal_source: a.source || "registry",
            signal_detail: a.detail || a.description,
            signal_url: a.url,
            signal_date: a.date || new Date().toISOString(),
            source_method: "registry",
            score: 4,
          });
        }
      } catch (e) {
        console.warn(`[trade-scanner] ${vertical} registry augment failed:`, e instanceof Error ? e.message : String(e));
      }

      // Wave 1 Batch 1C — federal area signals (HUD aging-housing, FFIEC HMDA,
      // FEMA NFIP repeat-loss, EPA ECHO water violations, NOAA SPC mesoscale).
      // Wave 1 Batch 1D — metro permit ArcGIS/Socrata layers (Grand Rapids,
      // Ann Arbor, Chicago, Cleveland, Columbus, Indy, Milwaukee, Nashville).
      // Pull client zips + coverage_regions across all active clients for
      // this vertical to scope both fetches.
      try {
        const { data: clientsForZips } = await sb
          .from("trade_radar_clients")
          .select("zip_codes, coverage_regions")
          .eq("vertical", vertical)
          .eq("active", true);
        const allZips = Array.from(new Set(
          (clientsForZips ?? []).flatMap((c: any) => (c.zip_codes as string[]) ?? []),
        )).filter(Boolean).slice(0, 50);
        const allRegions = Array.from(new Set(
          (clientsForZips ?? []).flatMap((c: any) => (c.coverage_regions as string[]) ?? []),
        )).filter(Boolean);

        const [fedSignals, metroSignals, deedSignals, pacerSignals] = await Promise.all([
          runFederalAreaSignals(vertical, state, allZips, sb).catch((e) => {
            console.warn(`[trade-scanner] ${vertical} federal-area-signals failed:`, e instanceof Error ? e.message : String(e));
            return [] as any[];
          }),
          runMetroPermitSignals(vertical as any, allRegions, sb).catch((e) => {
            console.warn(`[trade-scanner] ${vertical} metro-permits failed:`, e instanceof Error ? e.message : String(e));
            return [] as any[];
          }),
          runCountyDeedSignals(vertical as any, allRegions, sb).catch((e) => {
            console.warn(`[trade-scanner] ${vertical} county-deeds failed:`, e instanceof Error ? e.message : String(e));
            return [] as any[];
          }),
          runPacerBankruptcySignals(vertical as any, allRegions, sb).catch((e) => {
            console.warn(`[trade-scanner] ${vertical} pacer-bankruptcy failed:`, e instanceof Error ? e.message : String(e));
            return [] as any[];
          }),
        ]);
        for (const s of fedSignals) rawSignals.push(s);
        for (const s of metroSignals) rawSignals.push(s);
        for (const s of deedSignals) rawSignals.push(s);
        for (const s of pacerSignals) rawSignals.push(s);
      } catch (e) {
        console.warn(`[trade-scanner] ${vertical} area+metro fetch failed:`, e instanceof Error ? e.message : String(e));
      }

      const insertedLeads: any[] = [];

      for (const sig of rawSignals) {
        const result = await upsertWithDedup(sb, vertical, sig);
        if (result === "inserted") { stats.inserted++; insertedLeads.push(sig); }
        else if (result === "updated") stats.updated++;
        else if (result === "quarantined") stats.quarantined++;
        else if (result === "area") stats.area++;
        else stats.skipped++;
      }

      // Always notify clients — market intel goes out even with 0 per-address leads
      const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data: freshLeads } = await sb
        .from("trade_radar_leads")
        .select("*")
        .eq("vertical", vertical)
        .gte("created_at", since24h)
        .order("score", { ascending: false })
        .limit(10);

      await notifyClients(sb, vertical, (freshLeads as any[]) ?? []);
      stats.notified = freshLeads?.length ?? 0;
    } catch (e: unknown) {
      console.error(`[trade-scanner] ${vertical} error:`, e instanceof Error ? e.message : String(e));
    }
  }

  // Per-vertical SMS is already sent by trade-radar-am-digest at 9:30am ET.
  // No duplicate summary SMS here.

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
