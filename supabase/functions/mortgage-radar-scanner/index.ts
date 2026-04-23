// Mortgage Radar daily scanner — FCRA-clean pre-trigger mortgage signals
// Sources (all public/behavioral, NOT bureau): BSEED permits, MI SOS new LLCs,
// county foreclosure/lis pendens, FSBO, divorce filings, property-tax cures.
// Same arch as industry-pulse-scanner: parallel fetches via Promise.allSettled,
// score 1-10, dedup, alert clients whose ZIP matches.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_EMAIL = "matt@detroitwebagent.com";

interface RawSignal {
  full_name?: string;
  address?: string;
  city?: string;
  zip?: string;
  signal_type: string;
  signal_source: string;
  signal_detail?: string;
  signal_url?: string;
  signal_date?: string;
  estimated_equity?: number;
  estimated_loan_amount?: number;
}

// Heuristic scoring: heavier weight when intent is most immediate.
function scoreSignal(s: RawSignal): { score: number; opener: string; window: string } {
  let score = 5;
  let opener = "Hi — saw a public record and thought it might be worth a quick chat about mortgage options.";
  let window = "10am–6pm local";

  switch (s.signal_type) {
    case "kitchen_addition_permit":
    case "renovation_permit":
      score = 9;
      opener = "Hey {name} — saw the permit on the {address} project. A lot of folks doing this size of reno are pulling cash out instead of using a HELOC. Happy to run numbers on both, no pressure.";
      window = "11am–1pm or 5pm–7pm";
      break;
    case "fsbo_listing":
      score = 8;
      opener = "Hi {name} — saw your home is for sale by owner. When the next purchase comes around I help local buyers structure financing and lock in rates early. Worth 5 min when you're ready?";
      window = "5pm–8pm weekdays / weekends";
      break;
    case "lis_pendens":
    case "foreclosure_notice":
      score = 9;
      opener = "Hi {name} — I work with families in this exact spot. There are 2–3 refi options that can stop the clock if we move in the next couple weeks. Can I send the comparison?";
      window = "9am–11am (less hectic)";
      break;
    case "divorce_filing":
      score = 7;
      opener = "Hi {name} — when something like this comes up, the mortgage piece is usually the last thing handled. I can quietly pre-qualify you for a buyout refi so you have options on the table.";
      window = "lunch hour or 6pm+";
      break;
    case "new_llc_self_employed":
      score = 6;
      opener = "Hi {name} — congrats on the new business. Most lenders want 2 yrs of self-employed tax returns; I work with bank-statement loans that get around that. Want me to run numbers?";
      window = "10am–noon";
      break;
    case "property_tax_cure":
      score = 7;
      opener = "Hi {name} — saw the tax position get cured. If the cash came out of savings and you'd rather rebuild reserves, a quick cash-out refi might make sense. 5 min call?";
      window = "5pm–7pm";
      break;
    case "high_equity_low_rate":
      score = 6;
      opener = "Hi {name} — your home has a lot of trapped equity right now. If you're sitting on a sub-4 rate I have a couple of HELOC options that don't touch the first mortgage.";
      window = "afternoon";
      break;
    case "job_change_high_income":
      score = 7;
      opener = "Hi {name} — congrats on the move. New role often means relocation or a step-up purchase. I help structure financing before the listing rush. Worth 10 min?";
      window = "lunch or evening";
      break;
    default:
      score = 5;
  }
  return { score, opener, window };
}

// === SOURCE STUBS ===
// Each returns RawSignal[] from public/behavioral data only.
// In production these wire to: BSEED ArcGIS, MI SOS LARA, county recorder e-portals,
// Sonar OSINT for FSBO/divorce/job changes. Stubs return [] safely until wired.

async function scanBSEEDPermits(): Promise<RawSignal[]> {
  // Detroit Open Data ArcGIS — bseed_trades_permits feature service
  // Filter for renovation / kitchen / addition permit types issued in last 7 days.
  try {
    const url = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/BSEED_Trades_Permits/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=50&f=json&orderByFields=ISSUED_DATE+DESC";
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    const out: RawSignal[] = [];
    for (const f of (j.features || [])) {
      const a = f.attributes || {};
      const desc = String(a.WORK_DESCRIPTION || a.SCOPE_OF_WORK || "").toLowerCase();
      const isReno = /kitchen|addition|remodel|bath|whole house|finish basement/.test(desc);
      if (!isReno) continue;
      out.push({
        address: a.SITE_ADDRESS || a.ADDRESS || "",
        city: a.SITE_CITY || "Detroit",
        zip: String(a.SITE_ZIP || a.ZIP || "").slice(0, 5) || undefined,
        signal_type: "renovation_permit",
        signal_source: "BSEED",
        signal_detail: String(a.WORK_DESCRIPTION || "Renovation permit").slice(0, 200),
        signal_date: a.ISSUED_DATE ? new Date(a.ISSUED_DATE).toISOString().slice(0, 10) : undefined,
      });
    }
    return out.slice(0, 25);
  } catch (e) {
    console.warn("[scanBSEEDPermits]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function scanNewMichiganLLCs(): Promise<RawSignal[]> {
  // MI SOS LARA does not expose a public REST endpoint we can hit unauthenticated;
  // wire via existing industry_pulse new_business signals downstream.
  return [];
}

async function scanForeclosureNotices(): Promise<RawSignal[]> {
  // Wayne / Oakland / Macomb county recorder lis pendens — Sonar wired separately.
  return [];
}

async function scanFSBOListings(): Promise<RawSignal[]> {
  // Zillow/Redfin scrape — wire via Firecrawl when ready.
  return [];
}

async function scanDivorceFilings(): Promise<RawSignal[]> { return []; }
async function scanPropertyTaxCures(): Promise<RawSignal[]> { return []; }
async function scanHighEquityLowRate(): Promise<RawSignal[]> { return []; }
async function scanJobChanges(): Promise<RawSignal[]> { return []; }

async function notifyClients(sb: ReturnType<typeof createClient>, leadId: string, zip: string | undefined, score: number): Promise<string[]> {
  if (!zip || score < 7) return [];
  const { data: clients } = await (sb.from as any)("mortgage_radar_clients")
    .select("id, email, contact_name, business_name, zip_codes")
    .eq("active", true);
  const matched = (clients || []).filter((c: any) => Array.isArray(c.zip_codes) && c.zip_codes.includes(zip));
  return matched.map((c: any) => c.id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const startedAt = new Date().toISOString();

  const results = await Promise.allSettled([
    scanBSEEDPermits(),
    scanNewMichiganLLCs(),
    scanForeclosureNotices(),
    scanFSBOListings(),
    scanDivorceFilings(),
    scanPropertyTaxCures(),
    scanHighEquityLowRate(),
    scanJobChanges(),
  ]);

  const signals: RawSignal[] = [];
  const sourceBreakdown: Record<string, number> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const s of r.value) {
        signals.push(s);
        sourceBreakdown[s.signal_source] = (sourceBreakdown[s.signal_source] || 0) + 1;
      }
    }
  }

  let inserted = 0;
  let alertsQueued = 0;
  for (const s of signals) {
    const { score, opener, window } = scoreSignal(s);
    const row = {
      full_name: s.full_name || null,
      address: s.address || null,
      city: s.city || null,
      state: "MI",
      zip: s.zip || null,
      signal_type: s.signal_type,
      signal_source: s.signal_source,
      signal_detail: s.signal_detail || null,
      signal_url: s.signal_url || null,
      signal_date: s.signal_date || null,
      estimated_equity: s.estimated_equity || null,
      estimated_loan_amount: s.estimated_loan_amount || null,
      score,
      suggested_opener: opener,
      best_call_window: window,
      raw: s as unknown as Record<string, unknown>,
    };
    const { data: ins, error } = await (sb.from as any)("mortgage_radar_leads")
      .upsert(row, { onConflict: "address,signal_type,signal_date", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("[mortgage-radar-scanner] upsert error:", error.message);
      continue;
    }
    if (!ins) continue;
    inserted += 1;

    const matchedClientIds = await notifyClients(sb, ins.id, s.zip, score);
    if (matchedClientIds.length > 0) {
      await (sb.from as any)("mortgage_radar_leads")
        .update({ notified_client_ids: matchedClientIds })
        .eq("id", ins.id);
      alertsQueued += matchedClientIds.length;
    }
  }

  // Daily digest to Matt
  if (RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [ADMIN_EMAIL],
          subject: `🏠 Mortgage Radar — ${inserted} new leads, ${alertsQueued} client alerts`,
          html: `<p><strong>Mortgage Radar daily run</strong></p>
            <p>Started: ${startedAt}<br>Signals fetched: ${signals.length}<br>Inserted (new): ${inserted}<br>Client alerts queued: ${alertsQueued}</p>
            <pre>${JSON.stringify(sourceBreakdown, null, 2)}</pre>`,
        }),
      });
    } catch (e) {
      console.warn("[mortgage-radar-scanner] digest send failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    started_at: startedAt,
    signals_fetched: signals.length,
    inserted,
    alerts_queued: alertsQueued,
    source_breakdown: sourceBreakdown,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
