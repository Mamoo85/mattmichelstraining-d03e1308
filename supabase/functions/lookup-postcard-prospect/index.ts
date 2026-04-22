/**
 * lookup-postcard-prospect — public, returns minimal safe fields for a postcard
 * recipient so the /postcard QR landing page can personalize ("Welcome, {Company}").
 *
 * Only exposes business_name + city + audience type. Never address, owner name,
 * phone, email, or anything else PII-sensitive. Logs the scan so we know the
 * postcard was actually scanned (separate from conversion clicks).
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { prospect_id, campaign_id } = await req.json().catch(() => ({}));

    if (!prospect_id || typeof prospect_id !== "string" || !UUID_RE.test(prospect_id)) {
      return new Response(JSON.stringify({ error: "Invalid prospect_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: prospect, error } = await sb
      .from("postcard_prospects")
      .select("id, business_name, city, county, postcard_sent_at")
      .eq("id", prospect_id)
      .maybeSingle();

    if (error || !prospect) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort scan log — non-blocking.
    try {
      await sb.from("postcard_conversions").insert({
        campaign_id: campaign_id || null,
        product_key: "qr_personalized_scan",
        event: "qr_scan_personalized",
        audience_type: "postcard",
        user_agent: (req.headers.get("user-agent") || "").slice(0, 200),
        referrer: (req.headers.get("referer") || "").slice(0, 200),
      });
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({
        business_name: prospect.business_name || null,
        city: prospect.city || null,
        county: prospect.county || null,
        postcard_sent_at: prospect.postcard_sent_at || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[lookup-postcard-prospect] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
