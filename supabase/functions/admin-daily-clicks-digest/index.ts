// Daily clicks digest — aggregates last 24h of landing page visits across DWA
// properties and sends Matt one summary SMS. Called by pg_cron at 8am ET.
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Pull last 24h of visitor events (DWA SiteRadar feed = all landing pages with the script)
  const { data: events, error } = await sb
    .from("crm_visitor_events")
    .select("page_visited, company_name, is_business, referrer, created_at")
    .gte("created_at", since)
    .limit(5000);

  if (error) {
    console.error("[clicks-digest] query failed:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const total = events?.length ?? 0;
  const businesses = events?.filter((e) => e.is_business).length ?? 0;
  const uniqueCompanies = new Set(
    events?.filter((e) => e.company_name).map((e) => e.company_name),
  ).size;

  // Top pages
  const pageCounts: Record<string, number> = {};
  for (const e of events ?? []) {
    const p = (e.page_visited || "/").split("?")[0].slice(0, 40);
    pageCounts[p] = (pageCounts[p] || 0) + 1;
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p, c]) => `${c}× ${p}`)
    .join("\n");

  const body =
    `📊 24h Clicks: ${total} visits` +
    (businesses ? ` (${businesses} biz, ${uniqueCompanies} cos)` : "") +
    (topPages ? `\n${topPages}` : "\nNo traffic.");

  const result = await sendSMS(ADMIN_PHONE, TWILIO_FROM, body, "dwa_admin_reply");

  return new Response(
    JSON.stringify({ ok: true, total, businesses, uniqueCompanies, sms: result }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
