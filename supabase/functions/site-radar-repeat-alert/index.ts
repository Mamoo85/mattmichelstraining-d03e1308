// site-radar-repeat-alert — hourly cron, SMS client when same company visits 3+ times in 7 days.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find companies with 3+ visits in last 7 days, grouped by client
  const { data: events } = await sb
    .from("crm_visitor_events")
    .select("client_id, company_name, city, page_visited, visit_count, last_seen_at")
    .eq("is_business", true)
    .gte("last_seen_at", since)
    .gte("visit_count", 3)
    .not("company_name", "is", null);

  if (!events?.length) return new Response(JSON.stringify({ ok: true, alerts: 0 }));

  // Group by client_id
  const byClient: Record<string, typeof events> = {};
  for (const e of events) {
    const cid = (e as { client_id: string }).client_id;
    if (!byClient[cid]) byClient[cid] = [];
    byClient[cid].push(e);
  }

  let alerts = 0;
  for (const [clientId, rows] of Object.entries(byClient)) {
    const { data: client } = await sb
      .from("field_crm_clients")
      .select("owner_phone, business_name, dispatch_token")
      .eq("id", clientId)
      .maybeSingle();

    const phone = (client as { owner_phone?: string } | null)?.owner_phone;
    if (!phone) continue;

    const token = (client as { dispatch_token?: string } | null)?.dispatch_token;
    const portalUrl = token
      ? `https://detroitwebagent.com/my-site-radar?token=${token}`
      : "https://detroitwebagent.com/my-site-radar";

    for (const row of rows as Array<{ company_name: string; city?: string; page_visited?: string; visit_count: number }>) {
      await sendSMS(
        phone,
        Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219",
        `🔁 ${row.company_name}${row.city ? ` (${row.city})` : ""} has visited your site ${row.visit_count}x this week. Last page: ${row.page_visited || "homepage"}. Full history: ${portalUrl}`,
        "site_radar_alert"
      );
      alerts++;
    }
  }

  return new Response(JSON.stringify({ ok: true, alerts }), { headers: { "Content-Type": "application/json" } });
});
