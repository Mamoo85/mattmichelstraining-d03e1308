// contractor-roi-sms — every Friday 9am ET
// Texts each active contractor their ROI magic link.
// CRITICAL: Only sends if at least one metric > 0 for the week.
// Uses roi_token (not client_id) in the URL — security by obscurity.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const SITE_URL = "https://detroitwebagent.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all active contractors with phones and roi_tokens
    const { data: contractors } = await sb
      .from("contractor_clients")
      .select("id, phone, business_name, roi_token")
      .eq("active", true)
      .not("phone", "is", null)
      .not("roi_token", "is", null);

    if (!contractors?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    let sent = 0;

    for (const contractor of contractors) {
      if (!contractor.phone || !contractor.roi_token) continue;

      // Gather this week's stats in parallel
      const [
        { count: leadsDelivered },
        { count: deadLeadsRevived },
        { count: missedCallsCaught },
        { count: licensesMonitored },
      ] = await Promise.all([
        sb.from("contractor_lead_purchases")
          .select("id", { count: "exact", head: true })
          .eq("contractor_id", contractor.id)
          .gte("purchased_at", sevenDaysAgo),
        sb.from("dead_lead_contacts" as any)
          .select("id", { count: "exact", head: true })
          .eq("contractor_id", contractor.id)
          .eq("status", "replied_positive")
          .gte("contractor_notified_at", sevenDaysAgo),
        sb.from("system_comms_log")
          .select("id", { count: "exact", head: true })
          .eq("product", "missed_call")
          .gte("created_at", sevenDaysAgo),
        sb.from("license_monitor_items" as any)
          .select("id", { count: "exact", head: true })
          .eq("contractor_id", contractor.id),
      ]);

      const total = (leadsDelivered || 0) + (deadLeadsRevived || 0) + (missedCallsCaught || 0);

      // ← KEY: skip if nothing happened this week — don't remind them of zeros
      if (total === 0) continue;

      const reportUrl = `${SITE_URL}/roi?token=${contractor.roi_token}`;

      const highlights: string[] = [];
      if ((leadsDelivered || 0) > 0) highlights.push(`${leadsDelivered} lead${leadsDelivered === 1 ? "" : "s"} delivered`);
      if ((deadLeadsRevived || 0) > 0) highlights.push(`${deadLeadsRevived} dead lead${deadLeadsRevived === 1 ? "" : "s"} revived`);
      if ((missedCallsCaught || 0) > 0) highlights.push(`${missedCallsCaught} missed call${missedCallsCaught === 1 ? "" : "s"} caught`);

      await sendSMS(
        contractor.phone,
        TWILIO_PHONE_NUMBER,
        `Your weekly results: ${highlights.join(", ")}. Full report: ${reportUrl} — Matt (313) 806-4952`,
        "roi_scorecard"
      );

      sent++;
    }

    console.log(`[contractor-roi-sms] Sent to ${sent}/${contractors.length} contractors`);
    return new Response(
      JSON.stringify({ ok: true, sent, total: contractors.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[contractor-roi-sms] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
