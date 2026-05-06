// Launches an ad campaign on Meta (Facebook + Instagram) using the Marketing API.
// Requires META_AD_ACCESS_TOKEN + META_AD_ACCOUNT_ID secrets.
// If secrets are missing, returns a "manual" status so the admin UI can show paste-ready instructions.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const META_TOKEN = Deno.env.get("META_AD_ACCESS_TOKEN") || "";
const META_AD_ACCOUNT = Deno.env.get("META_AD_ACCOUNT_ID") || ""; // e.g. act_123456789
const META_PAGE_ID = Deno.env.get("META_PAGE_ID") || "";
const META_API = "https://graph.facebook.com/v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { draft_id } = await req.json();
    if (!draft_id) {
      return new Response(JSON.stringify({ error: "draft_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: draft, error: fetchErr } = await sb
      .from("ad_launch_drafts" as any).select("*").eq("id", draft_id).maybeSingle();
    if (fetchErr || !draft) throw new Error(`Draft not found: ${fetchErr?.message}`);

    const d = draft as any;

    // ── Phase 1 mode: secrets missing → mark manual, return paste-ready
    if (!META_TOKEN || !META_AD_ACCOUNT || !META_PAGE_ID) {
      await sb.from("ad_launch_drafts" as any).update({
        meta_status: "manual",
        status: "launched",
        reviewed_at: new Date().toISOString(),
      }).eq("id", draft_id);
      return new Response(JSON.stringify({
        success: true,
        mode: "manual",
        message: "Meta API not configured — copy the creative below into Ads Manager",
        creative: {
          headline: d.meta_headline,
          primary_text: d.meta_primary_text,
          description: d.meta_description,
          image_prompt: d.meta_image_prompt,
          targeting: d.meta_targeting,
          daily_budget: d.meta_daily_budget_cents / 100,
          landing_url: d.landing_url,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Phase 2 mode: full Meta API auto-launch ──────────────────────────
    // 1. Create Campaign
    const campRes = await fetch(`${META_API}/${META_AD_ACCOUNT}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${d.business_name} — ${d.trade} · ${d.city}`,
        objective: "OUTCOME_LEADS",
        status: "PAUSED", // Safety: launches paused, Matt activates manually first time
        special_ad_categories: [],
        access_token: META_TOKEN,
      }),
    });
    const campData = await campRes.json();
    if (!campRes.ok) throw new Error(`Campaign create failed: ${JSON.stringify(campData)}`);

    // 2. Create Ad Set
    const targeting = d.meta_targeting || {};
    const adSetRes = await fetch(`${META_API}/${META_AD_ACCOUNT}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${d.city} - ${targeting.radius_miles || 15}mi`,
        campaign_id: campData.id,
        daily_budget: d.meta_daily_budget_cents,
        billing_event: "IMPRESSIONS",
        optimization_goal: "LEAD_GENERATION",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: {
          geo_locations: { cities: [{ name: d.city, region: d.state || "MI", country: "US", radius: targeting.radius_miles || 15, distance_unit: "mile" }] },
          age_min: targeting.age_min || 28,
          age_max: targeting.age_max || 65,
        },
        status: "PAUSED",
        access_token: META_TOKEN,
      }),
    });
    const adSetData = await adSetRes.json();
    if (!adSetRes.ok) throw new Error(`Ad set create failed: ${JSON.stringify(adSetData)}`);

    // 3. Persist
    await sb.from("ad_launch_drafts" as any).update({
      meta_status: "launched",
      meta_campaign_id: campData.id,
      meta_launched_at: new Date().toISOString(),
      status: "launched",
      reviewed_at: new Date().toISOString(),
    }).eq("id", draft_id);

    return new Response(JSON.stringify({
      success: true,
      mode: "auto",
      campaign_id: campData.id,
      ad_set_id: adSetData.id,
      message: "Campaign created in PAUSED state. Activate in Meta Ads Manager when ready.",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[launch-meta-ad] error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const body = await req.clone().json().catch(() => ({}));
      if (body.draft_id) {
        await sb.from("ad_launch_drafts" as any).update({
          meta_status: "failed", meta_launch_error: msg,
        }).eq("id", body.draft_id);
      }
    } catch {}
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
