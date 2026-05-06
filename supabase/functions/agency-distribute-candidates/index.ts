import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
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
 * Defenses:
 * - Random jitter (0–2hr) before sending to defeat 7am-pattern inference
 * - Passive pool mix-in (1 in every 5 picks from candidates 1–3yr old) to
 *   defeat "newly licensed = just scraped" inference
 * - Rate limit: max 50 deliveries per agency per 24h window
 * - Output is fully sanitized via shared scrubber (no source attribution)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Skip jitter on manual invocations (admin testing) — only delay scheduled cron runs
  const body = await req.json().catch(() => ({}));
  const isCron = body?.trigger === "cron" || req.headers.get("x-cron-trigger") === "1";
  if (isCron) {
    const jitterMs = Math.floor(Math.random() * 2 * 3600 * 1000); // 0–2hr
    console.log(`[agency-distribute] Jitter: sleeping ${Math.round(jitterMs / 60000)}min before run`);
    await new Promise((r) => setTimeout(r, jitterMs));
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const stats = {
    agencies_processed: 0,
    candidates_distributed: 0,
    emails_sent: 0,
    rate_limited: 0,
    passive_mixed: 0,
    errors: [] as string[],
  };

  try {
    const { data: agencies = [] } = await supabase
      .from("staffing_agency_clients")
      .select("*")
      .eq("active", true);

    // Fresh pool: last 36h, score >= 6
    const sinceISO = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data: freshCandidates = [] } = await supabase
      .from("hire_alert_candidates")
      .select("*")
      .gte("created_at", sinceISO)
      .gte("score", 6)
      .order("score", { ascending: false })
      .limit(200);

    // Passive pool: licensed 1–3 years ago with score >= 5 (defeats "just scraped" inference)
    const passiveSince = new Date(Date.now() - 3 * 365 * 86400 * 1000).toISOString();
    const passiveBefore = new Date(Date.now() - 365 * 86400 * 1000).toISOString();
    const { data: passivePool = [] } = await supabase
      .from("hire_alert_candidates")
      .select("*")
      .gte("created_at", passiveSince)
      .lt("created_at", passiveBefore)
      .gte("score", 5)
      .order("score", { ascending: false })
      .limit(50);

    if (!freshCandidates?.length) {
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

      // Rate limit: 50 deliveries per agency per 24h
      const last24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: recentCount = 0 } = await supabase
        .from("agency_candidate_assignments")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agency.id)
        .gte("delivered_at", last24h);
      if ((recentCount ?? 0) >= 50) {
        stats.rate_limited++;
        console.log(`[agency-distribute] Rate-limited: ${agency.agency_name} (${recentCount} in last 24h)`);
        continue;
      }

      const matchAgency = (c: any): boolean => {
        const candCounty = (c.county || c.location || "").trim();
        if (!candCounty) return false;
        if (agency.territory_counties && !agency.territory_counties.includes(candCounty)) return false;
        const role = (c.role || "").toLowerCase();
        const isHealthcare = /\b(rn|lpn|cna|nurse|home\s*health|aide)\b/.test(role);
        const isIndustrial = /\b(boiler|hvac|electric|plumb|stationary|engineer|machinist)\b/.test(role);
        if (agency.vertical === "healthcare" && !isHealthcare) return false;
        if (agency.vertical === "industrial" && !isIndustrial) return false;
        const lockKey = `${agency.vertical}:${candCounty}`;
        const lockedTo = lockMap.get(lockKey);
        if (lockedTo && lockedTo !== agency.id) return false;
        return true;
      };

      const freshMatches = (freshCandidates || []).filter(matchAgency);
      const passiveMatches = (passivePool || []).filter(matchAgency);

      if (!freshMatches.length && !passiveMatches.length) continue;

      // Pattern-break mix-in: every 5th slot pulls from passive pool when available
      const blended: any[] = [];
      const cap = Math.min(10, Math.max(0, 50 - (recentCount ?? 0)));
      for (let i = 0; blended.length < cap && (freshMatches.length || passiveMatches.length); i++) {
        if (i % 5 === 4 && passiveMatches.length) {
          blended.push(passiveMatches.shift());
          stats.passive_mixed++;
        } else if (freshMatches.length) {
          blended.push(freshMatches.shift());
        } else if (passiveMatches.length) {
          blended.push(passiveMatches.shift());
        }
      }

      // Insert assignments (skip duplicates via unique constraint)
      for (const c of blended) {
        const { error } = await supabase.from("agency_candidate_assignments").insert({
          agency_id: agency.id,
          candidate_id: c.id,
          status: "delivered",
          signal_strength: c.score >= 8 ? "exceptional" : c.score >= 6 ? "strong" : "moderate",
        });
        if (!error) stats.candidates_distributed++;
      }

      // PERFECT STORM: cross-reference Demand Radar signals for this agency's territory + vertical
      // Only confidence >= 8 to preserve the wow factor
      let perfectStormSignals: any[] = [];
      try {
        const stormSince = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
        const { data: signals = [] } = await supabase
          .from("industry_pulse_signals")
          .select("company_name, location, county, expansion_type, predicted_needs, confidence, vertical, industry")
          .gte("detected_at", stormSince)
          .gte("confidence", 8)
          .limit(20);
        perfectStormSignals = (signals || []).filter((s: any) => {
          const sigCounty = (s.county || s.location || "").toLowerCase();
          const countyMatch = !agency.territory_counties?.length || agency.territory_counties.some((c: string) => sigCounty.includes(c.toLowerCase()));
          if (!countyMatch) return false;
          const sigVert = ((s.vertical || s.industry || "")).toLowerCase();
          if (agency.vertical === "industrial") return /hvac|cnc|weld|electric|boiler|plumb|industrial|steel/.test(sigVert);
          if (agency.vertical === "healthcare") return /health|medic|nurs|cna|rn|lpn/.test(sigVert);
          return true;
        }).slice(0, 3);
        if (perfectStormSignals.length) {
          await supabase.from("system_comms_log").insert({
            channel: "email", product: "perfect_storm_match",
            recipient: agency.contact_email,
            body_preview: `${perfectStormSignals.length} signals matched ${blended.length} candidates`,
            status: "matched", metadata: { agency_id: agency.id, signals: perfectStormSignals.map((s: any) => s.company_name) },
          });
        }
      } catch (e) {
        console.error(`[perfect-storm] match failed for ${agency.id}:`, e);
      }

      // Email the agency (sanitized output only)
      if (RESEND_API_KEY && agency.contact_email && blended.length) {
        // Sinkhole test accounts
        if (agency.is_test_account) {
          await supabase.from("system_comms_log").insert({
            channel: "email", product: "agency_distribution",
            recipient: agency.contact_email, body_preview: `${blended.length} candidates (sinkhole)`,
            status: "sinkhole", metadata: { agency_id: agency.id },
          });
          continue;
        }
        const sanitized = sanitizeBatch(blended);
        const portalUrl = `https://www.detroitwebagent.com/agency-portal?id=${agency.id}`;
        const html = buildAgencyEmail(agency.agency_name, sanitized, portalUrl, perfectStormSignals);
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

function buildAgencyEmail(name: string, candidates: any[], portalUrl: string, perfectStorm: any[] = []): string {
  const stormCard = perfectStorm.length ? `
    <div style="background:linear-gradient(135deg,#7c2d12,#b45309);border:1px solid #fbbf24;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="color:#fef3c7;font-size:11px;font-weight:700;letter-spacing:1.5px;margin-bottom:8px;">⚡ PERFECT STORM ALERT</div>
      ${perfectStorm.map((s: any) => `
        <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:12px;margin-top:8px;">
          <div style="color:#fff;font-weight:600;font-size:15px;">${s.company_name}</div>
          <div style="color:#fef3c7;font-size:12px;margin-top:4px;">${s.county || s.location || "MI"} · ${s.expansion_type || "Expansion signal"} · Confidence ${s.confidence}/10</div>
          <div style="color:#fde68a;font-size:12px;margin-top:6px;">They're hiring AND we have matching candidates ready below ↓</div>
        </div>`).join("")}
    </div>` : "";
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
