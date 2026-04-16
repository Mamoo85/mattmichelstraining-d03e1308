import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeBatch } from "../_shared/sanitize-candidate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

/**
 * Daily 7am ET cron — assigns new candidates to active agencies based on
 * vertical + territory_counties, respecting agency_territory_locks (exclusivity).
 *
 * Output to agencies is fully sanitized (no source attribution).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const stats = { agencies_processed: 0, candidates_distributed: 0, emails_sent: 0, errors: [] as string[] };

  try {
    const { data: agencies = [] } = await supabase
      .from("staffing_agency_clients")
      .select("*")
      .eq("active", true);

    const sinceISO = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data: candidates = [] } = await supabase
      .from("hire_alert_candidates")
      .select("*")
      .gte("created_at", sinceISO)
      .gte("score", 6)
      .order("score", { ascending: false })
      .limit(200);

    if (!candidates?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No new candidates", stats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: locks = [] } = await supabase
      .from("agency_territory_locks")
      .select("*")
      .eq("active", true);

    const lockMap = new Map<string, string>(); // "vertical:county" -> agency_id
    for (const l of locks || []) lockMap.set(`${l.vertical}:${l.county}`, l.agency_id);

    for (const agency of agencies || []) {
      stats.agencies_processed++;
      const matches: any[] = [];

      for (const c of candidates) {
        const candCounty = (c.county || c.location || "").trim();
        if (!candCounty) continue;
        if (agency.territory_counties && !agency.territory_counties.includes(candCounty)) continue;

        // Vertical match (best-effort — role string check)
        const role = (c.role || "").toLowerCase();
        const isHealthcare = /\b(rn|lpn|cna|nurse|home\s*health|aide)\b/.test(role);
        const isIndustrial = /\b(boiler|hvac|electric|plumb|stationary|engineer|machinist)\b/.test(role);
        if (agency.vertical === "healthcare" && !isHealthcare) continue;
        if (agency.vertical === "industrial" && !isIndustrial) continue;

        // Territory exclusivity check
        const lockKey = `${agency.vertical}:${candCounty}`;
        const lockedTo = lockMap.get(lockKey);
        if (lockedTo && lockedTo !== agency.id) continue;

        matches.push(c);
      }

      if (!matches.length) continue;

      // Insert assignments (skip duplicates)
      for (const c of matches.slice(0, 10)) {
        const { error } = await supabase.from("agency_candidate_assignments").insert({
          agency_id: agency.id,
          candidate_id: c.id,
          status: "delivered",
          signal_strength: c.score >= 8 ? "exceptional" : c.score >= 6 ? "strong" : "moderate",
        });
        if (!error) stats.candidates_distributed++;
      }

      // Email the agency
      if (RESEND_API_KEY && agency.contact_email) {
        const sanitized = sanitizeBatch(matches.slice(0, 10));
        const portalUrl = `https://www.detroitwebagent.com/agency-portal?id=${agency.id}`;
        const html = buildAgencyEmail(agency.agency_name, sanitized, portalUrl);
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Detroit Web Agency <matt@detroitwebagent.com>",
              to: agency.contact_email,
              subject: `${sanitized.length} pre-market candidates in your feed`,
              html,
            }),
          });
          stats.emails_sent++;
        } catch (e) {
          stats.errors.push(`Email ${agency.id}: ${e}`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), stats }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildAgencyEmail(name: string, candidates: any[], portalUrl: string): string {
  const rows = candidates.map(c => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #1a2942;color:#e2e8f0;">${c.name}</td>
      <td style="padding:12px;border-bottom:1px solid #1a2942;color:#94a3b8;">${c.licensed_role}</td>
      <td style="padding:12px;border-bottom:1px solid #1a2942;color:#94a3b8;">${c.county}</td>
      <td style="padding:12px;border-bottom:1px solid #1a2942;">
        <span style="background:${c.signal_strength === 'exceptional' ? '#00d4ff' : '#06b6d4'};color:#0a1628;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;">${c.signal_strength.toUpperCase()}</span>
      </td>
    </tr>`).join("");
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a1628;font-family:-apple-system,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px;">
      <h1 style="color:#00d4ff;font-size:24px;margin:0 0 8px;">Pre-Market Talent Feed</h1>
      <p style="color:#94a3b8;margin:0 0 24px;">${candidates.length} new candidates flagged for ${name}</p>
      <table style="width:100%;border-collapse:collapse;background:#0f1f35;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#1a2942;">
          <th style="padding:12px;text-align:left;color:#00d4ff;font-size:12px;text-transform:uppercase;">Name</th>
          <th style="padding:12px;text-align:left;color:#00d4ff;font-size:12px;text-transform:uppercase;">Role</th>
          <th style="padding:12px;text-align:left;color:#00d4ff;font-size:12px;text-transform:uppercase;">County</th>
          <th style="padding:12px;text-align:left;color:#00d4ff;font-size:12px;text-transform:uppercase;">Signal</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${portalUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">⚡ Open Agency Portal →</a>
      </div>
      <p style="color:#64748b;font-size:12px;margin-top:32px;text-align:center;">Detroit Web Agency · Proprietary Talent Signal Engine</p>
    </div>
  </body></html>`;
}
