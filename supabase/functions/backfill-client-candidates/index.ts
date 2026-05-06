// Backfill: assign existing hire_alert_candidates to matching hire_alert_clients
// Safe to run any time — uses upsert with onConflict ignore.
// Fixes the "no names in dashboard" bug caused by an empty join table.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLE_KEYWORDS: Record<string, string[]> = {
  boiler_operator: ["boiler", "boiler operator", "steam"],
  steam_engineer: ["steam engineer", "boiler"],
  pressure_vessel: ["pressure vessel", "pvi", "inspector", "boiler"],
  hvac_tech: ["hvac", "air conditioning", "refrigeration", "heating", "mechanical"],
  refrigeration_tech: ["refrigeration", "hvac", "cooling"],
  plumber: ["plumber", "plumbing", "master plumber"],
  pipefitter: ["pipefitter", "steamfitter", "ua local", "ua 636", "fitter"],
  electrician: ["electrician", "electrical"],
  industrial_mechanic: ["industrial mechanic", "maintenance mechanic", "millwright"],
  fire_suppression: ["fire suppression", "sprinkler", "fire protection"],
  cna: ["cna", "certified nursing assistant", "nurse aide", "nursing assistant"],
  rn: ["rn", "registered nurse", "nurse"],
  lpn: ["lpn", "licensed practical nurse", "practical nurse"],
  director_of_nursing: ["director of nursing", "don", "nursing director"],
  home_health_aide: ["home health aide", "home health", "hha"],
};

const TRADE_TO_ROLES: Record<string, string[]> = {
  boiler: ["boiler_operator", "steam_engineer", "pressure_vessel"],
  hvac: ["hvac_tech", "refrigeration_tech"],
  plumbing: ["plumber", "pipefitter"],
  electrical: ["electrician"],
  nursing: ["rn", "lpn", "cna", "director_of_nursing"],
  home_health: ["home_health_aide", "cna"],
};

function candidateMatchesRoles(
  licenseType: string | null,
  trade: string | null,
  targetRoles: string[],
): boolean {
  if (!targetRoles?.length) return false;
  const lic = (licenseType || "").toLowerCase();
  const tr = (trade || "").toLowerCase();

  // 1) Direct keyword match on license_type
  for (const role of targetRoles) {
    const kws = ROLE_KEYWORDS[role] || [role];
    if (kws.some((kw) => lic.includes(kw))) return true;
  }

  // 2) Trade family fallback (boiler→boiler_operator, etc.)
  const familyRoles = TRADE_TO_ROLES[tr] || [];
  return familyRoles.some((r) => targetRoles.includes(r));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { client_id, min_score = 5, dry_run = false } =
      await req.json().catch(() => ({}));

    // Load clients
    let clientsQ = sb.from("hire_alert_clients").select("id, company_name, target_roles, active").eq("active", true);
    if (client_id) clientsQ = clientsQ.eq("id", client_id);
    const { data: clients, error: clientsErr } = await clientsQ;
    if (clientsErr) throw clientsErr;

    // Load eligible candidates: actionable + score >= min_score + not demo + not company
    const { data: candidates, error: candErr } = await sb
      .from("hire_alert_candidates")
      .select("id, name, full_name, license_type, trade, score, availability_score, phone, email, linkedin_url, facebook_url, is_demo_record, is_company_name")
      .eq("is_demo_record", false)
      .eq("is_company_name", false)
      .or(`score.gte.${min_score},availability_score.gte.${min_score}`);
    if (candErr) throw candErr;

    const eligible = (candidates || []).filter((c: any) => {
      const hasContact = c.phone || c.email || c.linkedin_url || c.facebook_url;
      return hasContact;
    });

    const summary: Array<{ client: string; matched: number; inserted: number }> = [];
    let totalInserted = 0;

    for (const client of clients || []) {
      const targetRoles: string[] = (client as any).target_roles || [];
      const matches = eligible.filter((c: any) =>
        candidateMatchesRoles(c.license_type, c.trade, targetRoles)
      );

      if (!matches.length) {
        summary.push({ client: client.company_name, matched: 0, inserted: 0 });
        continue;
      }

      if (dry_run) {
        summary.push({ client: client.company_name, matched: matches.length, inserted: 0 });
        continue;
      }

      const rows = matches.map((c: any) => ({
        client_id: client.id,
        candidate_id: c.id,
        alerted_at: new Date().toISOString(),
        alert_type: "backfill",
      }));

      // Upsert in batches of 100
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error: upErr, count } = await sb
          .from("hire_alert_client_candidates")
          .upsert(batch, { onConflict: "client_id,candidate_id", ignoreDuplicates: true, count: "exact" });
        if (!upErr) inserted += count || batch.length;
      }
      totalInserted += inserted;
      summary.push({ client: client.company_name, matched: matches.length, inserted });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dry_run,
        total_clients: (clients || []).length,
        total_eligible_candidates: eligible.length,
        total_inserted: totalInserted,
        summary,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e instanceof Error ? e.message : e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
