// agency-prospect-pool
// Returns the freshest "proof pool" for a staffing agency:
//   1. hire_alert_candidates that match the vertical (industrial / healthcare),
//      with a tiered lookback fallback (7d → 30d → 90d → all-time).
//   2. techalert_prospect_targets — companies actively hiring in the same
//      vertical — used as a "hiring demand" proof source when there are
//      no candidates yet.
// This is what makes the Agency Outreach drawer never silently empty.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const HC_RX = /\b(rn|lpn|cna|nurse|nursing|aide|home\s*health|caregiver|medical|clinical|therapist|hha|healthcare|health|patient|cma|mma|phlebot)\b/i;
const IND_RX = /\b(boiler|hvac|electric|plumb|stationary\s+engineer|machinist|welder|fitter|pipefitter|fabricat|cnc|millwright|trades|mechanic|technician|maintenance|operator|industrial|skilled|automotive)\b/i;

const HC_ROLES = new Set(["nursing", "home_health", "healthcare", "rn", "lpn", "cna"]);
const IND_TARGET_ROLES = new Set(["hvac_tech", "boiler_operator", "plumber", "electrician"]);

function looksLikeRealCandidate(c: any): boolean {
  const n = String(c.full_name || c.name || "").trim();
  if (n.length < 5) return false;
  if (/[?:!@#$%/]/.test(n)) return false;
  if (n.split(/\s+/).filter(Boolean).length < 2) return false;
  if (/^\s*(go\s+back|uh\s+oh|search|loading|submit|sign\s+in|log\s+in|next|previous|view\s+all|learn\s+more|error|menu|home|click\s+here)\b/i.test(n)) return false;
  return !!(c.current_employer || c.current_title || c.city || c.phone || c.email || c.linkedin_url);
}

function matchesVertical(c: any, vertical: string): boolean {
  const text = `${c.trade || ""} ${c.current_title || ""} ${c.license_type || ""} ${c.qualifications_summary || ""} ${c.current_employer || ""}`;
  return vertical === "healthcare" ? HC_RX.test(text) : IND_RX.test(text);
}

async function fetchCandidatesWithFallback(sb: any, vertical: string) {
  const windows: { label: string; days: number | null }[] = [
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
    { label: "all", days: null },
  ];

  for (const w of windows) {
    let q = sb
      .from("hire_alert_candidates")
      .select("id, name, full_name, trade, city, metro, score, current_title, current_employer, qualifications_summary, license_type, years_experience, email, phone, linkedin_url, data_completeness, created_at")
      .eq("is_company_name", false)
      .eq("do_not_contact", false)
      .neq("enrichment_status", "junk");
    if (w.days != null) q = q.gte("created_at", new Date(Date.now() - w.days * 86400000).toISOString());
    q = q.order("data_completeness", { ascending: false }).order("score", { ascending: false }).limit(200);

    const { data } = await q;
    const filtered = (data || []).filter(looksLikeRealCandidate).filter((c: any) => matchesVertical(c, vertical));
    if (filtered.length > 0) {
      return { window: w.label, candidates: filtered };
    }
  }
  return { window: "none", candidates: [] };
}

async function fetchHiringDemand(sb: any, vertical: string) {
  // Pull active hiring-demand companies from techalert_prospect_targets.
  // For industrial agencies, we want HVAC/plumbing/electrical/boiler shops.
  // For healthcare agencies we don't yet have a dedicated source, so this
  // returns empty for healthcare — the UI handles that gracefully.
  if (vertical !== "industrial") return [];
  const { data } = await sb
    .from("techalert_prospect_targets")
    .select("id, company_name, city, role, score, source_label, status, created_at")
    .in("role", Array.from(IND_TARGET_ROLES))
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { vertical = "industrial" } = await req.json().catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const [candResult, hiring] = await Promise.all([
      fetchCandidatesWithFallback(sb, vertical),
      fetchHiringDemand(sb, vertical),
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        vertical,
        candidates: candResult.candidates,
        candidate_window: candResult.window,
        hiring_demand: hiring,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
