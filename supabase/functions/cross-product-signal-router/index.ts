// Cross-product signal router. Items #36, #37, #38.
// READ-ONLY: scans hire_alert_candidates with flight_risk=HIGH whose employer is NOT a TechAlert client,
// creates rows in cross_product_signals for Matt to review. No outbound contact, no automation.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeName } from "../_shared/flight-risk.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Get TechAlert client business names (normalized) so we don't pitch existing clients
    const { data: clients } = await sb.from("hire_alert_clients").select("business_name").eq("subscription_status", "active");
    const clientSet = new Set((clients ?? []).map(c => normalizeName(c.business_name ?? "")).filter(Boolean));

    // High flight-risk candidates from last 14 days
    const { data: highRisk } = await sb
      .from("hire_alert_candidates")
      .select("id, current_employer, trade, county, flight_risk_proof")
      .eq("flight_risk", "HIGH")
      .not("current_employer", "is", null)
      .gte("first_seen_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .limit(200);

    let created = 0;
    const seen = new Set<string>();

    for (const c of highRisk ?? []) {
      const empKey = normalizeName(c.current_employer);
      if (!empKey || clientSet.has(empKey) || seen.has(empKey)) continue;
      seen.add(empKey);

      // Already routed?
      const { data: existing } = await sb
        .from("cross_product_signals")
        .select("id")
        .eq("employer_name", c.current_employer)
        .eq("signal_type", "flight_risk_employer_hiring_lead")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();
      if (existing) continue;

      await sb.from("cross_product_signals").insert({
        signal_type: "flight_risk_employer_hiring_lead",
        source_table: "hire_alert_candidates",
        source_id: c.id,
        employer_name: c.current_employer,
        trade: c.trade,
        county: c.county,
        pitch_angle: `Tech leaving (${c.flight_risk_proof ?? "high flight risk"}) — employer likely needs to hire. Pitch TechAlert.`,
        routed_to: "techalert_outreach_queue",
        status: "new",
      });
      created++;
    }

    return new Response(JSON.stringify({ ok: true, created }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
