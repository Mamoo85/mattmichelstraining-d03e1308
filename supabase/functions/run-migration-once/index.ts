// One-time migration runner — DELETE THIS FUNCTION after use.
// Applies mortgage_radar county + region columns to the live DB.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("RUN_MIGRATION_SECRET") || "mig-2026-05-02";

serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== SECRET) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Use raw postgres via rpc if available, otherwise use supabase-js DDL workaround
  // Since supabase-js doesn't do DDL, we need the pg connection via rpc
  // Instead: do what we can via JS SDK — update the record directly
  // The columns are being added via migration files in the repo (Lovable deploys them).
  // This function just ensures Matt's record is correctly populated.

  const results: Record<string, unknown> = {};

  // 1. Check current state of Matt's client record
  const { data: before } = await sb
    .from("mortgage_radar_clients")
    .select("id, email, zip_codes, coverage_counties, coverage_regions")
    .eq("email", "matt@detroitwebagent.com")
    .single();

  results.before = before;

  // 2. If coverage_regions column doesn't exist, before.coverage_regions is undefined
  //    If it does exist but is empty, it's []
  //    Either way: set zip_codes to SE Michigan zips as fallback
  const seMichiganZips = [
    // Wayne County
    "48201","48202","48204","48205","48206","48207","48208","48209","48210","48211",
    "48213","48214","48215","48216","48217","48219","48221","48223","48224","48225",
    "48226","48227","48228","48229","48234","48235","48238","48239","48240","48243",
    // Dearborn / Dearborn Heights / Allen Park / Lincoln Park
    "48120","48121","48122","48124","48125","48126","48127","48128","48134","48141",
    // Livonia / Westland / Garden City / Inkster
    "48150","48151","48152","48153","48154","48185","48186","48326",
    // Southgate / Taylor / Wyandotte / Riverview
    "48183","48184","48192","48193","48195",
    // Macomb County — Warren, Sterling Heights, Roseville, St. Clair Shores
    "48088","48089","48091","48092","48093","48310","48311","48312","48313","48314",
    "48315","48316","48317","48318","48066","48080","48081","48082","48083","48084",
    // Oakland County — Troy, Royal Oak, Southfield, Pontiac, Auburn Hills
    "48009","48067","48068","48069","48070","48071","48072","48073","48075","48076",
    "48220","48237","48301","48302","48303","48304","48306","48307","48308","48309",
    "48320","48321","48322","48323","48324","48325","48327","48328","48329","48330",
    "48331","48332","48333","48334","48335","48336","48340","48341","48342","48343",
    "48346","48347","48348","48350","48353","48356","48357","48359","48360","48361",
    "48362","48363","48367","48370","48371","48374","48375","48376","48377","48378",
  ];

  // 3. Try to update coverage_regions (will work if column exists)
  const { error: regErr } = await (sb.from as any)("mortgage_radar_clients")
    .update({ coverage_regions: ["Southeast Michigan"], coverage_counties: [] as string[] })
    .eq("email", "matt@detroitwebagent.com");

  results.coverage_regions_update = regErr ? regErr.message : "ok";

  // 4. Always restore zip_codes as fallback so digest works even without new columns
  const { error: zipErr } = await sb
    .from("mortgage_radar_clients")
    .update({ zip_codes: seMichiganZips })
    .eq("email", "matt@detroitwebagent.com");

  results.zip_codes_update = zipErr ? zipErr.message : `set ${seMichiganZips.length} SE Michigan zips`;

  // 5. Read final state
  const { data: after } = await sb
    .from("mortgage_radar_clients")
    .select("id, email, zip_codes, coverage_counties, coverage_regions")
    .eq("email", "matt@detroitwebagent.com")
    .single();

  results.after = after;
  results.zip_count = after?.zip_codes?.length ?? 0;

  return new Response(JSON.stringify({ ok: true, ...results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
