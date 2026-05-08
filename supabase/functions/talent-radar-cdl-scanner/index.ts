// talent-radar-cdl-scanner
// National CDL/trucking pipeline using FMCSA SAFER (free, public) — finds active carriers
// with USDOT numbers, then surfaces driver-employment leads via carrier as employer.
// This unlocks Hunter/Apollo enrichment because carrier_name = company.
//
// POST { state?: string, limit?: number, dry_run?: boolean }
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATES_50 = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

// FMCSA public dataset endpoint via Socrata (data.transportation.gov / data.cdc.gov mirrors).
// We use the FMCSA Motor Carrier Census public Socrata feed.
async function fetchFMCSA(state: string, limit = 50): Promise<any[]> {
  // Filter active carriers (status_code='A') with at least 1 driver, ordered by recent registration
  const url = `https://data.transportation.gov/resource/az4n-8mr2.json?phy_state=${state}&status_code=A&$where=total_drivers%3E0&$limit=${limit}&$order=add_date+DESC`;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.warn(`[cdl] FMCSA ${state} status=${r.status}`);
      return [];
    }
    return await r.json();
  } catch (e) {
    console.warn(`[cdl] FMCSA ${state}:`, (e as Error).message);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const dryRun = !!body?.dry_run;
  const stateArg: string | undefined = body?.state;
  const limit = Math.min(Number(body?.limit) || 100, 500);

  const states = stateArg ? [stateArg.toUpperCase()] : (() => {
    const today = Math.floor(Date.now() / 86400000);
    const idx = today % STATES_50.length;
    return [STATES_50[idx], STATES_50[(idx + 10) % 50], STATES_50[(idx + 25) % 50]];
  })();

  let pulled = 0, inserted = 0, skipped = 0;
  const samples: any[] = [];

  for (const state of states) {
    const carriers = await fetchFMCSA(state, Math.floor(limit / states.length));
    pulled += carriers.length;
    for (const c of carriers) {
      const carrierName = (c.legal_name || "").trim();
      if (!carrierName) continue;
      const phone = (c.phone || "").replace(/\D/g, "").slice(-10) || null;
      const driverCount = parseInt(c.total_drivers || "0", 10) || 0;
      const cdlCount = parseInt(c.total_cdl || "0", 10) || 0;
      const score = driverCount > 50 ? 8 : driverCount > 10 ? 6 : 4;

      if (dryRun) {
        if (samples.length < 8) samples.push({ carrier: carrierName, state: c.phy_state, drivers: driverCount, cdl: cdlCount, dot: c.dot_number });
        continue;
      }

      if (c.dot_number) {
        const { data: exist } = await sb.from("hire_alert_candidates").select("id")
          .eq("license_number", `DOT-${c.dot_number}`).maybeSingle();
        if (exist) { skipped++; continue; }
      }

      const { error } = await sb.from("hire_alert_candidates").insert({
        name: carrierName,
        full_name: carrierName,
        trade: "cdl_trucking",
        city: c.phy_city || null,
        state: c.phy_state || state,
        zip: (c.phy_zip || "").slice(0, 5) || null,
        license_type: "USDOT Carrier",
        license_number: c.dot_number ? `DOT-${c.dot_number}` : null,
        phone,
        current_employer: carrierName,
        source: "fmcsa_safer",
        score,
        status: "new",
        is_company_name: true,
        raw_data: { dot_number: c.dot_number, docket: c.docket1 ? `${c.docket1prefix || "MC"}-${c.docket1}` : null, drivers: driverCount, cdl_drivers: cdlCount, power_units: c.power_units, classdef: c.classdef, add_date: c.add_date },
      });
      if (error) { skipped++; continue; }
      inserted++;
    }
  }

  return new Response(JSON.stringify({
    ok: true, dry_run: dryRun, states, pulled, inserted, skipped, samples,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
