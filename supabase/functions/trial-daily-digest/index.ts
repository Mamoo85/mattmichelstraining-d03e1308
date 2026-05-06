// trial-daily-digest — Daily SMS to Matt with trial funnel health.
// Runs at 13:00 UTC (9am ET) every day. Queries radar_trials + trial_signups.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalActive },
    { data: newYesterday },
    { data: expiredNoConvert },
    { data: topProducts },
  ] = await Promise.all([
    sb.from("radar_trials").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("radar_trials").select("product").gte("trial_started_at", yesterday).eq("status", "active"),
    sb.from("radar_trials").select("id", { count: "exact", head: true })
      .lt("expires_at", now.toISOString()).eq("status", "active"),
    sb.from("radar_trials").select("product").eq("status", "active").limit(200),
  ]);

  const newCount = newYesterday?.length ?? 0;
  const expiredCount = expiredNoConvert ?? 0;

  // Top product by active trial count
  const productCounts: Record<string, number> = {};
  for (const row of topProducts ?? []) {
    productCounts[row.product] = (productCounts[row.product] || 0) + 1;
  }
  const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];

  const msg = [
    `📊 TRIAL DIGEST ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    `Active: ${totalActive ?? 0} | New (24h): ${newCount} | Expired no-convert: ${expiredCount}`,
    topProduct ? `Top: ${topProduct[0].replace("_", " ")} (${topProduct[1]})` : null,
    newCount === 0 ? "⚠️ No new trials today — check cold email pipeline" : null,
  ].filter(Boolean).join("\n");

  await sendSMS(ADMIN_PHONE, TWILIO_FROM, msg, "trial_daily_digest", false, { bypassQuietHours: false })
    .catch((e) => console.error("[trial-daily-digest] SMS failed", e));

  return new Response(
    JSON.stringify({ ok: true, active: totalActive, new_24h: newCount }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
