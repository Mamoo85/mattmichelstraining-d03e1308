// talent-radar-nurse-scanner
// National nurse pipeline using NPI Registry (free, no key, public).
// Searches taxonomy codes for RN, LPN, NP, CNA across all 50 states.
// Inserts into hire_alert_candidates with trade='nursing'/'home_health' and is_company_name=false.
//
// POST { state?: string, limit?: number, dry_run?: boolean }
//   default: rotates through all 50 states, ~50/state per run
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NPI taxonomy codes — Registered Nurse, LPN, Nurse Practitioner, Home Health Aide
const NURSE_TAXONOMIES = [
  { code: "163W00000X", label: "Registered Nurse", trade: "nursing" },
  { code: "164W00000X", label: "Licensed Practical Nurse", trade: "nursing" },
  { code: "363L00000X", label: "Nurse Practitioner", trade: "nursing" },
  { code: "374J00000X", label: "Home Health Aide", trade: "home_health" },
  { code: "374T00000X", label: "Religious Nonmedical Nursing Personnel", trade: "home_health" },
];

const STATES_50 = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

async function fetchNPI(taxonomy: string, state: string, skip = 0): Promise<any[]> {
  // NPI Registry public API — https://npiregistry.cms.hhs.gov/api/?version=2.1
  const url = new URL("https://npiregistry.cms.hhs.gov/api/");
  url.searchParams.set("version", "2.1");
  url.searchParams.set("enumeration_type", "NPI-1"); // individuals only
  url.searchParams.set("taxonomy_description", taxonomy);
  url.searchParams.set("state", state);
  url.searchParams.set("limit", "200");
  url.searchParams.set("skip", String(skip));
  try {
    const r = await fetch(url.toString());
    if (!r.ok) return [];
    const j = await r.json();
    return j?.results || [];
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const dryRun = !!body?.dry_run;
  const stateArg: string | undefined = body?.state;
  const limit = Math.min(Number(body?.limit) || 100, 500);

  // Rotate states by day-of-year to spread load (or use explicit state arg)
  const states = stateArg ? [stateArg.toUpperCase()] : (() => {
    const today = Math.floor(Date.now() / 86400000);
    const idx = today % STATES_50.length;
    // 5 states per day-rotation
    return [STATES_50[idx], STATES_50[(idx + 10) % 50], STATES_50[(idx + 20) % 50], STATES_50[(idx + 30) % 50], STATES_50[(idx + 40) % 50]];
  })();

  let pulled = 0, inserted = 0, skipped = 0;
  const samples: any[] = [];

  for (const state of states) {
    for (const tax of NURSE_TAXONOMIES) {
      const results = await fetchNPI(tax.label, state);
      pulled += results.length;
      for (const npi of results.slice(0, limit / states.length / NURSE_TAXONOMIES.length)) {
        const basic = npi.basic || {};
        const addr = (npi.addresses || []).find((a: any) => a.address_purpose === "LOCATION") || npi.addresses?.[0] || {};
        const fullName = [basic.first_name, basic.middle_name, basic.last_name].filter(Boolean).join(" ");
        if (!fullName) continue;
        const phone = addr.telephone_number || null;
        const license = (npi.taxonomies || [])[0]?.license || null;

        if (dryRun) {
          if (samples.length < 8) samples.push({ name: fullName, state: addr.state, license, taxonomy: tax.label });
          continue;
        }

        // Dedupe by license_number when present, else by name+state
        const dedupe = license
          ? await sb.from("hire_alert_candidates").select("id").eq("license_number", license).maybeSingle()
          : await sb.from("hire_alert_candidates").select("id").eq("full_name", fullName).eq("state", addr.state || state).maybeSingle();
        if (dedupe.data) { skipped++; continue; }

        const { error } = await sb.from("hire_alert_candidates").insert({
          name: fullName,
          full_name: fullName,
          trade: tax.trade,
          city: addr.city || null,
          state: addr.state || state,
          zip: (addr.postal_code || "").slice(0, 5) || null,
          license_type: tax.label,
          license_number: license,
          phone,
          source: "npi_registry",
          score: phone ? 6 : 4,
          status: "new",
          is_company_name: false,
          raw_data: { npi: npi.number, taxonomy_code: tax.code },
        });
        if (error) { skipped++; continue; }
        inserted++;
      }
    }
  }

  return new Response(JSON.stringify({
    ok: true, dry_run: dryRun, states, pulled, inserted, skipped, samples,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
