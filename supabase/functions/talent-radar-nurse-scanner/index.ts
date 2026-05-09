// talent-radar-nurse-scanner
// NPI Registry → emits RawCandidate[] to talent-ingest. No direct DB writes.
import type { RawCandidate } from "../_shared/talent-ingest/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function fetchNPI(taxonomy: string, state: string): Promise<any[]> {
  const url = new URL("https://npiregistry.cms.hhs.gov/api/");
  url.searchParams.set("version", "2.1");
  url.searchParams.set("enumeration_type", "NPI-1");
  url.searchParams.set("taxonomy_description", taxonomy);
  url.searchParams.set("state", state);
  url.searchParams.set("limit", "200");
  try {
    const r = await fetch(url.toString());
    if (!r.ok) return [];
    const j = await r.json();
    return j?.results || [];
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
    return [STATES_50[idx], STATES_50[(idx + 10) % 50], STATES_50[(idx + 20) % 50], STATES_50[(idx + 30) % 50], STATES_50[(idx + 40) % 50]];
  })();

  const candidates: RawCandidate[] = [];
  let pulled = 0;
  const samples: any[] = [];

  for (const state of states) {
    for (const tax of NURSE_TAXONOMIES) {
      const results = await fetchNPI(tax.label, state);
      pulled += results.length;
      const cap = Math.max(1, Math.floor(limit / states.length / NURSE_TAXONOMIES.length));
      for (const npi of results.slice(0, cap)) {
        const basic = npi.basic || {};
        const addr = (npi.addresses || []).find((a: any) => a.address_purpose === "LOCATION") || npi.addresses?.[0] || {};
        const fullName = [basic.first_name, basic.middle_name, basic.last_name].filter(Boolean).join(" ");
        if (!fullName) continue;
        const license = (npi.taxonomies || [])[0]?.license || null;

        if (dryRun) {
          if (samples.length < 8) samples.push({ name: fullName, state: addr.state, license, taxonomy: tax.label });
          continue;
        }

        candidates.push({
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
          raw_data: { npi: npi.number, taxonomy_code: tax.code },
        });
      }
    }
  }

  if (dryRun) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, states, pulled, samples }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let ingest: any = null;
  if (candidates.length) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/talent-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({ source: "npi_registry", replay_url: "talent-radar-nurse-scanner", suppress_sms: true, candidates }),
    });
    ingest = await r.json().catch(() => null);
  }

  return new Response(JSON.stringify({ ok: true, states, pulled, sent: candidates.length, ingest }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
