// marketplace-reengagement — daily 11am ET cron
// Emails buyers with last_seen_at > 7d when there are unread leads in their products.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: stale } = await supabase
    .from("marketplace_buyer_visits")
    .select("buyer_email, last_seen_at")
    .lt("last_seen_at", cutoff);

  if (!stale?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: recent } = await supabase
    .from("mortgage_radar_leads")
    .select("id")
    .gte("created_at", cutoff);
  const newCount = recent?.length || 0;
  if (!newCount) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no new leads" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let sent = 0;
  for (const v of stale) {
    const days = Math.floor((Date.now() - new Date(v.last_seen_at).getTime()) / (24 * 3600 * 1000));
    // Dedup — don't email more than once per 7d
    const { data: existing } = await supabase
      .from("system_comms_log")
      .select("id")
      .eq("recipient", v.buyer_email)
      .eq("subject", `🚨 ${newCount} new leads since you last looked`)
      .gte("created_at", cutoff)
      .maybeSingle();
    if (existing) continue;

    const html = `
      <h2 style="font-family:system-ui">It's been ${days} days.</h2>
      <p><strong>${newCount} new leads</strong> have hit the marketplace since your last visit.</p>
      <p><a href="https://detroitwebagent.com/marketplace" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block">See What's New →</a></p>
    `;
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Detroit Web Agency <matt@detroitwebagent.com>", to: v.buyer_email, subject: `🚨 ${newCount} new leads since you last looked`, html }),
      }).catch(() => {});
    }
    await supabase.from("system_comms_log").insert({
      channel: "email",
      recipient: v.buyer_email,
      subject: `🚨 ${newCount} new leads since you last looked`,
      body: "Reengagement",
      product: "marketplace",
      direction: "outbound",
    });
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
