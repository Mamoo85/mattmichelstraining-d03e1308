// marketplace-hot-zone-notifier — daily 8am ET cron
// Finds ZIPs with 3+ new mortgage_radar_leads in last 7 days, emails saved-search subscribers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Detroit Web Agency <matt@detroitwebagent.com>", to, subject, html }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("mortgage_radar_leads")
    .select("zip, city")
    .gte("created_at", since);

  const zipCounts = new Map<string, { count: number; city: string }>();
  for (const r of rows || []) {
    if (!r.zip) continue;
    const cur = zipCounts.get(r.zip) || { count: 0, city: r.city || "" };
    cur.count += 1;
    zipCounts.set(r.zip, cur);
  }

  const hotZips = [...zipCounts.entries()].filter(([_, v]) => v.count >= 3);
  if (!hotZips.length) {
    return new Response(JSON.stringify({ ok: true, hot_zips: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: subs } = await supabase
    .from("marketplace_saved_searches")
    .select("buyer_email, zips, product")
    .eq("active", true);

  let sent = 0;
  for (const sub of subs || []) {
    const subZips: string[] = sub.zips || [];
    const matches = hotZips.filter(([z]) => subZips.includes(z));
    if (!matches.length) continue;

    const html = `
      <h2 style="font-family:system-ui">🔥 Hot Zone Alert</h2>
      <p>${matches.length} ZIP code${matches.length > 1 ? "s" : ""} in your saved search just lit up:</p>
      <ul>${matches.map(([z, v]) => `<li><strong>${z}</strong> (${v.city}) — ${v.count} new leads in 7 days</li>`).join("")}</ul>
      <p><a href="https://detroitwebagent.com/marketplace?product=${sub.product}" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block">Browse Marketplace →</a></p>
    `;
    await sendEmail(sub.buyer_email, `🔥 ${matches.length} hot ZIPs in your saved search`, html);
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, hot_zips: hotZips.length, emails_sent: sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
