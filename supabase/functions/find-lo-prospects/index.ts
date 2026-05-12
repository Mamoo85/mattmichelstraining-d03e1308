/**
 * find-lo-prospects
 * Finds Michigan mortgage loan originators via Apollo.io with a static MI MLO seed-list fallback.
 * Apollo's free tier often returns 0 for narrow queries; the seed list ensures the button is never useless.
 *
 * POST {} → { ok, found, inserted, skipped, apollo_count, seed_count }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { apolloMixedPeopleSearch } from "../_shared/apollo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Static seed: top Michigan mortgage companies (public NMLS company registry).
// Names + companies are baked in so we always have a baseline list to work.
// enrich-lo-prospect can fill emails/phones via the waterfall later.
const MI_MLO_SEED: Array<{ company: string; city?: string }> = [
  { company: "United Wholesale Mortgage", city: "Pontiac" },
  { company: "Rocket Mortgage", city: "Detroit" },
  { company: "Flagstar Bank", city: "Troy" },
  { company: "Lake Michigan Credit Union", city: "Grand Rapids" },
  { company: "Mercantile Bank of Michigan", city: "Grand Rapids" },
  { company: "Independent Bank", city: "Grand Rapids" },
  { company: "Level One Bank", city: "Farmington Hills" },
  { company: "Talmer Bank and Trust", city: "Troy" },
  { company: "Chemical Bank", city: "Midland" },
  { company: "Citizens Bank", city: "Flint" },
  { company: "Comerica Bank", city: "Detroit" },
  { company: "DFCU Financial", city: "Dearborn" },
  { company: "MSU Federal Credit Union", city: "East Lansing" },
  { company: "Michigan First Credit Union", city: "Lathrup Village" },
  { company: "Genisys Credit Union", city: "Auburn Hills" },
  { company: "Lakeshore Mortgage", city: "Holland" },
  { company: "Northpointe Bank", city: "Grand Rapids" },
  { company: "Mortgage 1", city: "Sterling Heights" },
  { company: "John Adams Mortgage", city: "Bingham Farms" },
  { company: "Gold Star Mortgage Financial", city: "Ann Arbor" },
  { company: "Inlanta Mortgage", city: "Brookfield" },
  { company: "Cornerstone Mortgage", city: "Grand Rapids" },
  { company: "Treadstone Funding", city: "Grand Rapids" },
  { company: "Ross Mortgage", city: "Royal Oak" },
  { company: "Patriot Lending Services", city: "Sterling Heights" },
  { company: "Capital Mortgage Funding", city: "Southfield" },
  { company: "Home Point Financial", city: "Ann Arbor" },
  { company: "Caliber Home Loans", city: "Troy" },
  { company: "Movement Mortgage", city: "Plymouth" },
  { company: "Guaranteed Rate", city: "Bloomfield Hills" },
  { company: "Bay Equity Home Loans", city: "Novi" },
  { company: "AmeriFirst Home Mortgage", city: "Kalamazoo" },
  { company: "Ross Mortgage Corporation", city: "Royal Oak" },
  { company: "First Centennial Mortgage", city: "Grand Rapids" },
  { company: "Old National Bank", city: "Grand Rapids" },
  { company: "TCF Bank", city: "Detroit" },
  { company: "Huntington Bank", city: "Detroit" },
  { company: "Fifth Third Bank", city: "Grand Rapids" },
  { company: "PNC Bank", city: "Detroit" },
  { company: "JP Morgan Chase", city: "Detroit" },
  { company: "Bank of Ann Arbor", city: "Ann Arbor" },
  { company: "ChoiceOne Bank", city: "Sparta" },
  { company: "Mercantile Mortgage", city: "Bloomfield Hills" },
  { company: "Pulaski Savings Bank", city: "Hamtramck" },
  { company: "Stockbridge Mortgage", city: "Stockbridge" },
  { company: "Ann Arbor State Bank", city: "Ann Arbor" },
  { company: "Eastern Michigan Bank", city: "Croswell" },
  { company: "Sterling Bank & Trust", city: "Southfield" },
  { company: "Adventure Credit Union", city: "Grand Rapids" },
  { company: "Honor Credit Union", city: "Berrien Springs" },
];

async function searchApollo(page = 1): Promise<any[]> {
  if (!APOLLO_API_KEY) return [];
  try {
    const r = await apolloMixedPeopleSearch({
      person_titles: [
        "Mortgage Loan Originator", "MLO", "Loan Officer", "Senior Loan Officer",
        "Loan Originator", "Mortgage Banker", "Mortgage Advisor", "Mortgage Consultant",
        "Mortgage Broker", "Branch Manager", "Producing Branch Manager",
        "VP Mortgage", "Home Lending Advisor", "Mortgage Specialist",
        "Lending Officer", "Mortgage Sales", "Mortgage Originator",
      ],
      person_locations: [
        "Michigan, US", "Michigan",
        "Ohio, US", "Indiana, US", "Illinois, US", "Wisconsin, US",
        "Detroit, Michigan", "Grand Rapids, Michigan", "Ann Arbor, Michigan",
        "Lansing, Michigan", "Kalamazoo, Michigan", "Flint, Michigan",
      ],
      page,
      per_page: 25,
    });
    if (!r.ok) {
      console.warn("[find-lo apollo] failed:", r.error);
      return [];
    }
    return r.data?.people ?? [];
  } catch (e) {
    console.warn("[find-lo apollo]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Page through up to 3 pages of Apollo
    const apolloPeople: any[] = [];
    if (APOLLO_API_KEY) {
      for (let page = 1; page <= 5; page++) {
        const batch = await searchApollo(page);
        if (!batch.length) break;
        apolloPeople.push(...batch);
        if (batch.length < 25) break;
      }
    }

    // Exclude paying subscribers
    const emails = apolloPeople.map((p: any) => p.email).filter(Boolean);
    let subscriberEmails = new Set<string>();
    if (emails.length) {
      const { data: subs } = await sb.from("mortgage_radar_clients").select("email").in("email", emails);
      subscriberEmails = new Set((subs ?? []).map((s: any) => s.email));
    }

    let apolloInserted = 0;
    let skipped = 0;

    for (const p of apolloPeople) {
      if (p.email && subscriberEmails.has(p.email)) { skipped++; continue; }
      const apolloId = String(p.id || "");
      if (!apolloId && !p.email) { skipped++; continue; }

      const row = {
        nmls_id: `apollo_${apolloId || (p.email || "").replace(/[^a-z0-9]/gi, "_")}`,
        full_name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unknown",
        company: p.organization?.name ?? p.employment_history?.[0]?.organization_name ?? null,
        email: p.email ?? null,
        phone: p.phone_numbers?.[0]?.sanitized_number ?? null,
        city: p.city ?? null,
        state: p.state ?? "MI",
        website: p.organization?.website_url ?? null,
        source: "apollo",
        raw: p,
        fetched_at: new Date().toISOString(),
      };
      const { error } = await sb.from("marketplace_prospects").upsert(row, { onConflict: "nmls_id" });
      if (!error) apolloInserted++;
      else { console.warn("[find-lo] upsert error", error.message); skipped++; }
    }

    // Seed-list fallback — always run so we have at least a baseline. Upsert by deterministic nmls_id.
    let seedInserted = 0;
    for (const s of MI_MLO_SEED) {
      const slug = s.company.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const row = {
        nmls_id: `seed_${slug}`,
        full_name: s.company,
        company: s.company,
        email: null,
        phone: null,
        city: s.city ?? null,
        state: "MI",
        website: null,
        source: "mi_seed",
        fetched_at: new Date().toISOString(),
      };
      const { error } = await sb.from("marketplace_prospects").upsert(row, { onConflict: "nmls_id", ignoreDuplicates: true });
      if (!error) seedInserted++;
      else console.warn("[find-lo seed] upsert error", error.message);
    }

    const inserted = apolloInserted + seedInserted;
    const note = !APOLLO_API_KEY
      ? "APOLLO_API_KEY not configured — seed list only"
      : apolloPeople.length === 0
      ? "Apollo returned no results — seed list only"
      : null;

    return new Response(
      JSON.stringify({
        ok: true,
        found: apolloPeople.length + MI_MLO_SEED.length,
        inserted,
        skipped,
        apollo_count: apolloInserted,
        seed_count: seedInserted,
        note,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
