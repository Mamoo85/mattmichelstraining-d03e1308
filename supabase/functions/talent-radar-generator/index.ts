import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERTICAL_ROLES: Record<string, string[]> = {
  trades:      ["boiler_operator", "hvac_tech", "steam_engineer", "pressure_vessel"],
  healthcare:  ["rn", "lpn", "cna", "home_health_aide", "don"],
  electrical:  ["electrician", "master_electrician", "journeyman_electrician"],
  plumbing:    ["plumber", "master_plumber", "pipefitter"],
  all:         [], // no filter — return highest scored across all verticals
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { token, vertical = "trades", count = 10 } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify token belongs to an active client
    const { data: client, error: clientErr } = await sb
      .from("talent_radar_clients")
      .select("id, plan, active, sheets_generated, target_verticals")
      .eq("dashboard_token", token)
      .single();

    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!client.active) {
      return new Response(JSON.stringify({ error: "subscription inactive" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sheet plan: limit to 1 per session (they paid per sheet)
    if (client.plan === "sheet" && client.sheets_generated >= 1) {
      return new Response(JSON.stringify({ error: "sheet already generated — upgrade to Starter for unlimited" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build role filter for this vertical
    const roles = VERTICAL_ROLES[vertical] || VERTICAL_ROLES.trades;

    let query = sb
      .from("hire_alert_candidates")
      .select("full_name, phone, email, license_type, license_number, license_expiry, city, zip, source, availability_score, score_reason, linkedin_url, facebook_url, current_employer, current_title, years_experience, qualifications_summary, hiring_recommendation, raw_data")
      .eq("license_state", "MI")
      .gte("availability_score", 5)
      .order("availability_score", { ascending: false })
      .limit(count);

    if (roles.length > 0) {
      // Filter candidates whose license_type overlaps with this vertical's roles
      const roleCondition = roles.map(r => `license_type.ilike.%${r.replace(/_/g, " ")}%`).join(",");
      query = query.or(roleCondition);
    }

    const { data: candidates, error: candidateErr } = await query;

    if (candidateErr) throw new Error(`candidate query: ${candidateErr.message}`);

    const sheet = (candidates || []).map((c: Record<string, unknown>) => ({
      full_name:          c.full_name,
      license_type:       c.license_type,
      license_number:     c.license_number,
      license_expiry:     c.license_expiry,
      city:               c.city,
      zip:                c.zip,
      phone:              c.phone || (c.raw_data as Record<string, unknown>)?.pdl_mobile_phone || null,
      email:              c.email || (c.raw_data as Record<string, unknown>)?.pdl_personal_email || null,
      linkedin_url:       c.linkedin_url,
      current_employer:   c.current_employer,
      current_title:      c.current_title,
      availability_score: c.availability_score,
      score_reason:       c.score_reason,
      source:             c.source,
      hiring_recommendation: c.hiring_recommendation,
    }));

    // Save sheet and increment counter
    const [{ data: savedSheet }, _] = await Promise.all([
      sb.from("talent_radar_sheets").insert({
        client_id:       client.id,
        vertical,
        state:           "MI",
        candidate_count: sheet.length,
        candidates:      sheet,
      }).select("id").single(),
      sb.from("talent_radar_clients").update({
        sheets_generated: (client.sheets_generated || 0) + 1,
      }).eq("id", client.id),
    ]);

    return new Response(JSON.stringify({ sheet_id: savedSheet?.id, vertical, candidates: sheet }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[talent-radar-generator]", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
