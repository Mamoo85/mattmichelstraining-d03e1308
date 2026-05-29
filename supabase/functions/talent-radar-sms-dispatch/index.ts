// talent-radar-sms-dispatch — TR-11
// Sends SMS to TechAlert clients when a SCORCHING (score >=9) candidate matches.
// Cron-driven (every 30 min) OR called directly with { candidate_id }.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let dispatched = 0;
  let skipped = 0;

  try {
    // Pull SCORCHING candidates (score >= 9) created in last 6 hours that have not been SMS dispatched yet
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: hot } = await sb
      .from("hire_alert_candidates")
      .select("id, name, role, location, score, license_number")
      .gte("score", 9)
      .gte("created_at", sixHoursAgo)
      .limit(50);

    if (!hot || hot.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0, scanned: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    for (const cand of hot) {
      // Find clients matching this candidate's role
      const { data: clients } = await sb
        .from("hire_alert_clients")
        .select("id, company_name, phone, dashboard_token, target_roles")
        .eq("active", true)
        .not("phone", "is", null);

      const matched = (clients || []).filter((c: any) =>
        Array.isArray(c.target_roles) &&
        c.target_roles.some((r: string) =>
          (cand.role || "").toLowerCase().includes(r.toLowerCase())
        )
      );

      for (const client of matched) {
        // Check if already SMS-dispatched
        const { data: existing } = await sb
          .from("hire_REDACTED")
          .select("id, sms_dispatched_at")
          .eq("client_id", client.id)
          .eq("candidate_id", cand.id)
          .maybeSingle();

        if (existing?.sms_dispatched_at) {
          skipped++;
          continue;
        }

        const claimUrl = `https://detroitwebagent.com/talent-radar/dashboard?token=${client.dashboard_token}&claim=${cand.id}`;
        const body = `🔥 SCORCHING ${cand.role} just surfaced in ${cand.location || "MI"}. Score ${cand.score}/10. CLAIM (48h lock): ${claimUrl}`;

        const result = await sendSMS(client.phone, TWILIO_FROM, body, "hire_alert");

        if (result.success) {
          // Upsert tracking row
          if (existing) {
            await sb
              .from("hire_REDACTED")
              .update({ sms_dispatched_at: new Date().toISOString() })
              .eq("id", existing.id);
          } else {
            await sb.from("hire_REDACTED").insert({
              client_id: client.id,
              candidate_id: cand.id,
              sms_dispatched_at: new Date().toISOString(),
            });
          }
          dispatched++;
        }
      }
    }

    return new Response(JSON.stringify({ dispatched, skipped, scanned: hot.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[talent-radar-sms-dispatch]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
