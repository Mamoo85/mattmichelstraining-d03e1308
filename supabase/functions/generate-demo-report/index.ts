import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE_TO_SIGNAL: Record<string, { label: string; why: string }> = {
  jatc_graduation:     { label: "New to Market",        why: "Just completed apprenticeship — no employer yet" },
  craigslist:          { label: "Actively Seeking Work", why: "Self-posted availability ad — actively looking" },
  thumbtack:           { label: "Actively Seeking Work", why: "Advertising for hire on Thumbtack right now" },
  yelp:                { label: "Owner-Operator",        why: "Independent contractor found advertising services" },
  val_enumeration:     { label: "Newly Licensed",        why: "License issued in the last 30 days — just entered the workforce" },
  license_expiry:      { label: "Between Jobs",          why: "License lapse detected — likely in transition" },
  npi:                 { label: "Verified Credential",   why: "Active on national healthcare registry" },
  nursys:              { label: "Verified Credential",   why: "Active license confirmed via nursing registry" },
  pdl:                 { label: "Available",             why: "No active employer lock-in detected" },
  miosha:              { label: "Verified Credential",   why: "Active Michigan state license confirmed" },
  building_permits:    { label: "Active in the Field",   why: "Pulled permits in Metro Detroit in last 90 days" },
  phcc:                { label: "Owner-Operator",        why: "Small shop owner — may be open to staff roles or contract work" },
  union:               { label: "Union Member",          why: "Listed in trade union directory" },
  nate:                { label: "Certified Technician",  why: "NATE-certified HVAC technician" },
  michigan_open_data:  { label: "Verified Credential",   why: "Active Michigan state license on record" },
  nurse_aide_registry: { label: "Verified Credential",   why: "Active Michigan Nurse Aide Registry listing" },
  sonar:               { label: "Available",             why: "Public signals suggest open to new opportunities" },
  google_places:       { label: "Owner-Operator",        why: "Independent contractor — open to larger opportunities" },
  indeed:              { label: "Actively Seeking Work", why: "Résumé posted on job board — actively looking" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: candidates } = await sb
      .from("hire_alert_candidates")
      .select("*")
      .order("availability_score", { ascending: false })
      .order("first_seen_at", { ascending: false })
      .limit(60);

    if (!candidates?.length) {
      return new Response(
        JSON.stringify({ error: "No candidates in database yet. Run the scanner first." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qualified = candidates
      .filter((c: any) => c.full_name && c.full_name.trim().split(" ").length >= 2)
      .filter((c: any) => c.license_number || c.city || c.license_type)
      .slice(0, 20);

    const tradeBreakdown: Record<string, number> = {};
    qualified.forEach((c: any) => {
      const t = c.license_type || "Other";
      tradeBreakdown[t] = (tradeBreakdown[t] || 0) + 1;
    });

    const reportCandidates = qualified.map((c: any) => {
      const signal = SOURCE_TO_SIGNAL[c.source || ""] || { label: "Verified Credential", why: "Found in verified trade database" };
      return {
        full_name: c.full_name,
        license_type: c.license_type || "Skilled Tradesperson",
        license_number: c.license_number || null,
        license_expiry: c.license_expiry || null,
        city: c.city || null,
        phone: c.phone || null,
        email: c.email || null,
        linkedin_url: c.linkedin_url || null,
        current_employer: c.current_employer || null,
        years_experience: c.years_experience || null,
        availability_label: signal.label,
        why_now: signal.why,
        score: c.availability_score || 5,
        first_seen: c.first_seen_at
          ? new Date(c.first_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : null,
      };
    });

    return new Response(
      JSON.stringify({
        report_date: new Date().toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
        }),
        summary: {
          total: qualified.length,
          hot: qualified.filter((c: any) => (c.availability_score || 0) >= 7).length,
          with_license: qualified.filter((c: any) => c.license_number).length,
          with_contact: qualified.filter((c: any) => c.phone || c.email).length,
          local: qualified.filter((c: any) => c.city).length,
          trades: tradeBreakdown,
        },
        candidates: reportCandidates,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generate-demo-report] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
