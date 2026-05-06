// site-radar-health-check — daily cron, pings each client's website to confirm
// the tracking snippet is still present. Emails client + SMS Matt if missing 48h+.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: clients } = await sb
    .from("field_crm_clients")
    .select("id, business_name, email, website, visitor_script_key")
    .eq("status", "active")
    .not("stripe_subscription_id", "is", null)
    .not("website", "is", null);

  let missing = 0;
  for (const client of (clients || []) as Array<{ id: string; business_name: string; email: string; website: string; visitor_script_key: string }>) {
    if (!client.website || !client.visitor_script_key) continue;
    try {
      const res = await fetch(client.website, { signal: AbortSignal.timeout(8000) });
      const html = await res.text();
      if (html.includes(client.visitor_script_key)) continue; // script found — healthy

      // Script missing — check if last visitor event was >48h ago
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await sb
        .from("crm_visitor_events")
        .select("id")
        .eq("client_id", client.id)
        .gte("created_at", cutoff)
        .limit(1);

      if (recent?.length) continue; // still getting events — maybe cached page

      missing++;
      const snippet = `<script>(function(){fetch("${SUPABASE_URL}/functions/v1/visitor-identify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({script_key:"${client.visitor_script_key}",page:window.location.href,referrer:document.referrer})})})();</script>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SiteRadar <matt@detroitwebagent.com>",
          to: [client.email],
          subject: `Action needed: your SiteRadar tracking stopped`,
          html: `<div style="font-family:sans-serif;max-width:520px;background:#0a1628;color:#fff;padding:32px;border-radius:8px;"><h2 style="color:#f59e0b;">⚠️ Tracking snippet not detected</h2><p>We haven't detected your SiteRadar snippet on <strong>${client.website}</strong> in the last 48 hours — you may have missed some visitors.</p><p>Paste this before your closing <code>&lt;/body&gt;</code> tag:</p><pre style="background:#1e293b;padding:16px;border-radius:6px;font-size:11px;overflow-x:auto;">${snippet}</pre><p style="color:#94a3b8;font-size:13px;">Reply to this email if you need help. — Matt</p></div>`,
        }),
      });

      await sendSMS(ADMIN_PHONE, TWILIO_PHONE, `⚠️ SiteRadar: ${client.business_name} script missing 48h+. Re-install email sent.`, "site_radar_health", false, { bypassQuietHours: false });
    } catch { /* fetch failed — site may be down, skip */ }
  }

  return new Response(JSON.stringify({ ok: true, missing }), { headers: { "Content-Type": "application/json" } });
});
