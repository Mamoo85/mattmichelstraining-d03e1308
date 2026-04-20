// Generates a complete ad draft (Meta + Google) for a contractor lead client.
// Triggered after a contractor_lead_subscription Stripe payment.
// Output is stored in ad_launch_drafts and Matt is texted a notification.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

interface DraftReq {
  contractor_id?: string;
  business_name: string;
  trade: string;
  city: string;
  state?: string;
  daily_budget_cents?: number;
  landing_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body: DraftReq = await req.json();
    if (!body.business_name || !body.trade || !body.city) {
      return new Response(JSON.stringify({ error: "business_name, trade, city required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const tradeLabel = body.trade.charAt(0).toUpperCase() + body.trade.slice(1);
    const landing = body.landing_url || `https://detroitwebagent.com/get-quote?trade=${encodeURIComponent(body.trade)}&city=${encodeURIComponent(body.city)}&utm_source=meta&utm_medium=paid&utm_campaign=${encodeURIComponent(body.business_name.replace(/\s+/g,"_"))}`;

    // Generate ad creative via Lovable AI
    const aiPrompt = `You are a Facebook Ads + Google Ads strategist for local home-service contractors. Generate a complete ad campaign for:

Business: ${body.business_name}
Trade: ${tradeLabel}
City: ${body.city}, ${body.state || "MI"}

Return ONLY valid JSON (no markdown, no commentary):
{
  "meta_headline": "max 40 chars, urgent local hook",
  "meta_primary_text": "125-150 chars, conversational, mentions city, problem-focused, ends with a soft CTA",
  "meta_description": "max 30 chars, secondary tagline",
  "meta_image_prompt": "detailed prompt for an AI image generator: photorealistic, ${tradeLabel.toLowerCase()} contractor in ${body.city}, no text overlay, professional",
  "meta_targeting": {
    "radius_miles": 15,
    "age_min": 28,
    "age_max": 65,
    "interests": ["Home improvement", "Homeownership"],
    "exclude_renters": true
  },
  "google_headlines": ["3 headlines max 30 chars each, include city + trade"],
  "google_descriptions": ["2 descriptions max 90 chars each"],
  "google_keywords": ["10 high-intent local keywords like '${tradeLabel.toLowerCase()} ${body.city}', '${tradeLabel.toLowerCase()} near me', etc"]
}`;

    let creative: any = null;
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: aiPrompt }],
          response_format: { type: "json_object" },
        }),
      });
      const aiData = await aiRes.json();
      const raw = aiData?.choices?.[0]?.message?.content || "{}";
      creative = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```\s*$/, ""));
    } catch (e) {
      console.error("[draft-ad] AI failed:", e);
      // Fallback templates
      creative = {
        meta_headline: `${tradeLabel} in ${body.city}? Call Now`,
        meta_primary_text: `Need a reliable ${tradeLabel.toLowerCase()} in ${body.city}? ${body.business_name} is local, fast, and ready to help. Get a free quote in under 5 minutes.`,
        meta_description: "Free quote · Local pros",
        meta_image_prompt: `professional ${tradeLabel.toLowerCase()} contractor at work in ${body.city} home, photorealistic, no text`,
        meta_targeting: { radius_miles: 15, age_min: 28, age_max: 65, interests: ["Home improvement"], exclude_renters: true },
        google_headlines: [`${tradeLabel} ${body.city}`, `Free Quote · ${body.business_name}`, `Local ${tradeLabel} Pros`],
        google_descriptions: [`Fast, local ${tradeLabel.toLowerCase()} in ${body.city}. Free quotes, licensed & insured.`, `Trusted by ${body.city} homeowners. Get a quote in 5 min.`],
        google_keywords: [`${body.trade} ${body.city}`, `${body.trade} near me`, `best ${body.trade} ${body.city}`, `emergency ${body.trade} ${body.city}`, `${body.trade} repair ${body.city}`, `local ${body.trade}`, `${body.trade} contractor ${body.city}`, `affordable ${body.trade}`, `${body.trade} estimate`, `${body.trade} services ${body.city}`],
      };
    }

    // Insert draft
    const { data: inserted, error: insErr } = await sb.from("ad_launch_drafts" as any).insert({
      contractor_id: body.contractor_id || null,
      business_name: body.business_name,
      trade: body.trade,
      city: body.city,
      state: body.state || "MI",
      meta_headline: creative.meta_headline,
      meta_primary_text: creative.meta_primary_text,
      meta_description: creative.meta_description,
      meta_image_prompt: creative.meta_image_prompt,
      meta_targeting: creative.meta_targeting,
      meta_daily_budget_cents: body.daily_budget_cents || 2000,
      google_headlines: creative.google_headlines,
      google_descriptions: creative.google_descriptions,
      google_keywords: creative.google_keywords,
      landing_url: landing,
      utm_params: `utm_source=meta&utm_medium=paid&utm_campaign=${encodeURIComponent(body.business_name.replace(/\s+/g, "_"))}`,
      status: "pending_review",
    }).select("id").maybeSingle();

    if (insErr) throw insErr;

    // Notify Matt
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_PHONE,
      `🚀 Ads ready for ${body.business_name} (${tradeLabel} · ${body.city})\n\nReview & launch: detroitwebagent.com/dwa-admin → 🚀 Ad Launcher`,
      "ad_draft_ready"
    ).catch(() => {});

    return new Response(JSON.stringify({ success: true, draft_id: (inserted as any)?.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[draft-ad-campaign] error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
