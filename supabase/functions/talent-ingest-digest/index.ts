// Weekly Monday 8am ET multi-source digest SMS to admin.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count } = await sb.from("hire_alert_candidates")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .filter("sources", "not.is", null);
  // Cheaper accurate count:
  const { data: rows } = await sb.from("hire_alert_candidates")
    .select("id, sources").gte("created_at", since).limit(2000);
  const multi = (rows || []).filter((r: any) => Array.isArray(r.sources) && r.sources.length > 1).length;
  const total = count ?? rows?.length ?? 0;
  if (TWILIO_FROM) {
    try {
      await sendSMS(ADMIN_PHONE, TWILIO_FROM,
        `🎯 TechAlert: ${multi} candidates confirmed by 2+ sources this week (of ${total} new) — highest quality leads.`,
        "techalert");
    } catch (_e) { /* ignore */ }
  }
  return new Response(JSON.stringify({ ok: true, multi, total }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
