// talent-radar-cdl-scanner
// FMCSA SAFER → emits RawCandidate[] to talent-ingest. No direct DB writes.
// POST { state?: string, limit?: number, dry_run?: boolean }
import type { RawCandidate } from "../_shared/talent-ingest/types.ts";

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

async function fetchFMCSA(state: string, limit = 50): Promise<any[]> {
  const url = `https://data.transportation.gov/resource/az4n-8mr2.json?phy_state=${state}&status_code=A&$where=total_drivers!='0'&$limit=${limit}&$order=add_date+DESC`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const dryRun = !!body?.dry_run;
  const stateArg: string | undefined = body?.state;
  const limit = Math.min(Number(body?.limit) || 100, 500);

  const states = stateArg ? [stateArg.toUpperCase()] : (() => {
    const today = Math.floor(Date.now() / 86400000);
    const idx = today % STATES_50.length;
    return [STATES_50[idx], STATES_50[(idx + 10) % 50], STATES_50[(idx + 25) % 50]];
  })();

  const candidates: RawCandidate[] = [];
  let pulled = 0;
  const samples: any[] = [];

  for (const state of states) {
    const carriers = await fetchFMCSA(state, Math.floor(limit / states.length));
    pulled += carriers.length;
    for (const c of carriers) {
      const carrierName = (c.legal_name || "").trim();
      if (!carrierName) continue;
      const driverCount = parseInt(c.total_drivers || "0", 10) || 0;
      const cdlCount = parseInt(c.total_cdl || "0", 10) || 0;

      if (dryRun) {
        if (samples.length < 8) samples.push({ carrier: carrierName, state: c.phy_state, drivers: driverCount, cdl: cdlCount, dot: c.dot_number });
        continue;
      }

      candidates.push({
        source: "fmcsa_safer",
        source_record_id: c.dot_number ? `DOT-${c.dot_number}` : undefined,
        source_url: c.dot_number ? `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${c.dot_number}` : undefined,
        observed_at: c.add_date || undefined,
        full_name: carrierName,
        trade: "cdl_trucking",
        city: c.phy_city || undefined,
        state: c.phy_state || state,
        zip: (c.phy_zip || "").slice(0, 5) || undefined,
        license_type: "USDOT Carrier",
        license_number: c.dot_number ? `DOT-${c.dot_number}` : undefined,
        phone: c.phone || undefined,
        current_employer: carrierName,
        is_company_name: true,
        raw_data: {
          dot_number: c.dot_number,
          docket: c.docket1 ? `${c.docket1prefix || "MC"}-${c.docket1}` : null,
          drivers: driverCount, cdl_drivers: cdlCount,
          power_units: c.power_units, classdef: c.classdef, add_date: c.add_date,
        },
      });
    }
  }

  if (dryRun) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, states, pulled, samples }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST batch to talent-ingest
  let ingest: any = null;
  if (candidates.length) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/talent-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({ source: "fmcsa_safer", replay_url: "talent-radar-cdl-scanner", candidates }),
    });
    ingest = await r.json().catch(() => null);
  }

  return new Response(JSON.stringify({ ok: true, states, pulled, sent: candidates.length, ingest }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
