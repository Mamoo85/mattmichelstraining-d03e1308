// talent-seed-bulk
// Comprehensive seeder for hire_alert_candidates — calls NPI + FMCSA in batches
// across all 50 states and routes through talent-ingest with suppress_sms=true.
// Safe to run multiple times (fingerprint dedup). Designed for nightly cron rotation.
// POST { states?: string[], limit_per_state?: number, sources?: ("npi"|"fmcsa")[], dry_run?: boolean }

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

// Picks the next 10-state window for today, cycling through all 50 over 5 days
function todaysStates(): string[] {
  const today = Math.floor(Date.now() / 86400000);
  const window = today % 5; // 0-4, cycling every 5 days
  const start = window * 10;
  return STATES_50.slice(start, start + 10);
}

const NURSE_TAXONOMIES = [
  { label: "Registered Nurse", trade: "nursing" },
  { label: "Licensed Practical Nurse", trade: "nursing" },
  { label: "Nurse Practitioner", trade: "nursing" },
  { label: "Home Health Aide", trade: "home_health" },
];

async function fetchNPI(taxonomy: string, state: string, limit = 200): Promise<any[]> {
  const url = new URL("https://npiregistry.cms.hhs.gov/api/");
  url.searchParams.set("version", "2.1");
  url.searchParams.set("enumeration_type", "NPI-1");
  url.searchParams.set("taxonomy_description", taxonomy);
  url.searchParams.set("state", state);
  url.searchParams.set("limit", String(Math.min(limit, 200)));
  try {
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.results || [];
  } catch { return []; }
}

async function fetchFMCSA(state: string, limit = 100): Promise<any[]> {
  const url = `https://data.transportation.gov/resource/az4n-8mr2.json?phy_state=${state}&status_code=A&$where=total_drivers!='0'&$limit=${Math.min(limit, 200)}&$order=add_date+DESC`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

async function postToIngest(candidates: RawCandidate[], source: string, replay_url: string): Promise<any> {
  if (!candidates.length) return { inserted: 0, merged: 0, rejected: 0 };
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/talent-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({ source, replay_url, suppress_sms: true, candidates }),
      signal: AbortSignal.timeout(30000),
    });
    return await r.json().catch(() => null);
  } catch (e) {
    return { error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${SUPABASE_SERVICE_KEY}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = !!body?.dry_run;
  const sources: string[] = body?.sources ?? ["npi", "fmcsa"];
  const limitPerState: number = Math.min(Number(body?.limit_per_state) || 200, 400);
  const states: string[] = body?.states ?? todaysStates();

  const stats = {
    ok: true, dry_run: dryRun,
    states_run: states,
    npi_fetched: 0, npi_inserted: 0, npi_merged: 0,
    fmcsa_fetched: 0, fmcsa_inserted: 0, fmcsa_merged: 0,
    errors: [] as string[],
  };

  if (dryRun) {
    return new Response(JSON.stringify({
      ...stats,
      preview: `Would seed ${states.length} states × sources: ${sources.join(",")} @ limit ${limitPerState}/state`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  for (const state of states) {
    // NPI Nurses
    if (sources.includes("npi")) {
      const npiCandidates: RawCandidate[] = [];
      for (const tax of NURSE_TAXONOMIES) {
        const perTax = Math.ceil(limitPerState / NURSE_TAXONOMIES.length);
        const results = await fetchNPI(tax.label, state, perTax);
        stats.npi_fetched += results.length;
        for (const npi of results.slice(0, perTax)) {
          const basic = npi.basic || {};
          const addr = (npi.addresses || []).find((a: any) => a.address_purpose === "LOCATION") || npi.addresses?.[0] || {};
          const fullName = [basic.first_name, basic.middle_name, basic.last_name].filter(Boolean).join(" ");
          if (!fullName) continue;
          const license = (npi.taxonomies || [])[0]?.license || null;
          npiCandidates.push({
            source: "npi_registry",
            source_record_id: npi.number ? `NPI-${npi.number}` : undefined,
            source_url: npi.number ? `https://npiregistry.cms.hhs.gov/provider-view/${npi.number}` : undefined,
            full_name: fullName,
            trade: tax.trade,
            city: addr.city || undefined,
            state: addr.state || state,
            zip: (addr.postal_code || "").slice(0, 5) || undefined,
            license_type: tax.label,
            license_number: license || undefined,
            phone: addr.telephone_number || undefined,
            is_company_name: false,
            raw_data: { npi: npi.number },
          });
        }
      }
      if (npiCandidates.length) {
        const res = await postToIngest(npiCandidates, "npi_registry", "talent-seed-bulk");
        stats.npi_inserted += res?.inserted ?? 0;
        stats.npi_merged += res?.merged ?? 0;
        if (res?.errors) stats.errors.push(`NPI ${state}: ${res.errors} errors`);
      }
    }

    // FMCSA CDL Carriers
    if (sources.includes("fmcsa")) {
      const carriers = await fetchFMCSA(state, limitPerState);
      stats.fmcsa_fetched += carriers.length;
      const fmcsaCandidates: RawCandidate[] = carriers
        .filter((c: any) => (c.legal_name || "").trim())
        .map((c: any) => ({
          source: "fmcsa_safer",
          source_record_id: c.dot_number ? `DOT-${c.dot_number}` : undefined,
          source_url: c.dot_number ? `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${c.dot_number}` : undefined,
          observed_at: c.add_date || undefined,
          full_name: (c.legal_name || "").trim(),
          trade: "cdl_trucking",
          city: c.phy_city || undefined,
          state: c.phy_state || state,
          zip: (c.phy_zip || "").slice(0, 5) || undefined,
          license_type: "USDOT Carrier",
          license_number: c.dot_number ? `DOT-${c.dot_number}` : undefined,
          phone: c.phone || undefined,
          current_employer: (c.legal_name || "").trim(),
          is_company_name: true,
          raw_data: { dot_number: c.dot_number, drivers: parseInt(c.total_drivers || "0", 10) },
        }));
      if (fmcsaCandidates.length) {
        const res = await postToIngest(fmcsaCandidates, "fmcsa_safer", "talent-seed-bulk");
        stats.fmcsa_inserted += res?.inserted ?? 0;
        stats.fmcsa_merged += res?.merged ?? 0;
        if (res?.errors) stats.errors.push(`FMCSA ${state}: ${res.errors} errors`);
      }
    }

    // Small delay between states to avoid cold-start pile-up on talent-ingest
    await new Promise(r => setTimeout(r, 300));
  }

  // Fire threshold-check after seeding so newly crossed states get prospect hunts immediately
  fetch(`${SUPABASE_URL}/functions/v1/talent-outreach-threshold-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
    body: "{}",
  }).catch(() => {});

  return new Response(JSON.stringify(stats), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
