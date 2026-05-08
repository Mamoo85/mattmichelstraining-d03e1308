// seed-mortgage-radar-trial-queue
// Pulls LOs from Apollo (national, paginated) + falls back to static MI seed,
// applies suppression filters, inserts into trial_resend_queue with product_key='mortgage_radar'.
//
// POST {} → { ok, apollo_pulled, inserted, skipped, total_queued }
import { createClient } from "npm:@supabase/supabase-js@2";
import { apolloMixedPeopleSearch } from "../_shared/apollo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TITLES = [
  "Mortgage Loan Officer", "Mortgage Loan Originator", "Senior Loan Officer",
  "Loan Officer", "MLO", "Mortgage Banker", "Loan Originator",
];

// All 50 states — we want true national coverage.
const STATES = [
  "Michigan","Ohio","Indiana","Illinois","Wisconsin","Pennsylvania","New York","New Jersey",
  "Florida","Georgia","Texas","California","Arizona","North Carolina","Tennessee","Virginia",
  "Massachusetts","Washington","Oregon","Colorado","Minnesota","Missouri","Maryland","Nevada",
  "Connecticut","South Carolina","Alabama","Kentucky","Louisiana","Oklahoma","Utah","Iowa",
  "Arkansas","Mississippi","Kansas","Nebraska","New Mexico","West Virginia","Idaho","Hawaii",
  "Maine","Montana","Delaware","Rhode Island","South Dakota","North Dakota","Vermont","Wyoming",
  "Alaska","New Hampshire",
];

async function pullApollo(state: string, page: number, perPage = 25): Promise<any[]> {
  if (!APOLLO_API_KEY) return [];
  try {
    const r = await apolloMixedPeopleSearch({
      person_titles: TITLES,
      person_locations: [state],
      page,
      per_page: perPage,
    } as any);
    if (!r.ok) {
      console.warn(`[seed-lo-queue] apollo ${state} p${page} status=${r.status}: ${r.error}`);
      return [];
    }
    return (r.data as any)?.people || (r.data as any)?.contacts || [];
  } catch (e) {
    console.warn(`[seed-lo-queue] apollo ${state} p${page}:`, (e as Error).message);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const dryRun = !!body?.dry_run;
  const statesArg: string[] = Array.isArray(body?.states) && body.states.length ? body.states : STATES;
  const pagesPerState = Math.min(Number(body?.pages_per_state) || 4, 10); // 4 pages × 25 = 100/state

  const candidates: Array<{ email: string; business_name: string | null; city: string | null; state: string }> = [];
  let apolloPulled = 0;

  // National Apollo pull
  for (const st of statesArg) {
    for (let p = 1; p <= pagesPerState; p++) {
      const people = await pullApollo(st, p);
      apolloPulled += people.length;
      for (const person of people) {
        const email = (person.email || "").trim().toLowerCase();
        if (!email || !email.includes("@") || email.startsWith("email_not_unlocked")) continue;
        candidates.push({
          email,
          business_name: person.organization?.name || person.organization_name || null,
          city: person.city || person.organization?.city || null,
          state: person.state || st,
        });
      }
      if (people.length < 25) break; // exhausted
    }
  }

  // Dedupe by email
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.email)) return false;
    seen.add(c.email);
    return true;
  });

  if (dryRun) {
    return new Response(JSON.stringify({
      ok: true, dry_run: true, apollo_pulled: apolloPulled, unique_candidates: unique.length,
      sample: unique.slice(0, 10),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Filter against suppression
  let inserted = 0, skipped = 0;
  for (const c of unique) {
    // Existing in queue?
    const { data: exist } = await sb.from("trial_resend_queue").select("id").ilike("email", c.email).maybeSingle();
    if (exist) { skipped++; continue; }
    // Suppression check
    const { data: supp } = await sb.from("suppressed_emails").select("email").ilike("email", c.email).maybeSingle();
    if (supp) { skipped++; continue; }
    // Past trial
    const { data: trial } = await sb.from("trial_signups").select("id").ilike("email", c.email).maybeSingle();
    if (trial) { skipped++; continue; }

    const { error } = await sb.from("trial_resend_queue").insert({
      email: c.email,
      business_name: c.business_name,
      city: c.city,
      state: c.state,
      industry: "mortgage_loan_officer",
      product_key: "mortgage_radar",
      product_label: "Mortgage Radar",
      source_table: "apollo_lo_seed",
      status: "pending",
    });
    if (error) { skipped++; continue; }
    inserted++;
  }

  const { count } = await sb.from("trial_resend_queue").select("*", { count: "exact", head: true })
    .eq("product_key", "mortgage_radar").eq("status", "pending");

  return new Response(JSON.stringify({
    ok: true, apollo_pulled: apolloPulled, unique_candidates: unique.length,
    inserted, skipped, total_queued: count ?? 0,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
