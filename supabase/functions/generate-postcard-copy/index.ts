/**
 * generate-postcard-copy
 * Generates 3 postcard copy variants using real TechAlert stats from the database.
 * Uses Gemini via Lovable AI Gateway.
 * Supports audience_type for industry-specific copy.
 * v2 — 2026-04-16 redeploy to ensure audience_type persists.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUDIENCE_PROMPTS: Record<string, string> = {
  trades: "HVAC, boiler service, plumbing, and electrical company owners",
  healthcare: "healthcare staffing agencies, home health companies, and nursing facilities hiring CNAs, LPNs, and RNs",
  nursing_home: "nursing home administrators and directors of nursing looking for certified nursing assistants and licensed nurses",
  contractor: "general contractors and specialty trade contractors hiring licensed tradespeople",
  supply_house: "plumbing, electrical, and HVAC supply house owners who want to connect with newly licensed contractors",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { county, audience_type } = await req.json();
    const targetCounty = county || "Macomb";
    const audience = audience_type || "trades";
    const audienceDesc = AUDIENCE_PROMPTS[audience] || AUDIENCE_PROMPTS.trades;

    // Pull REAL stats from hire_alert_runs and hire_alert_candidates
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [runsRes, candidatesRes, hotRes] = await Promise.all([
      sb.from("hire_alert_runs")
        .select("candidates_found")
        .gte("run_at", thirtyDaysAgo),
      sb.from("hire_alert_candidates")
        .select("id")
        .gte("created_at", thirtyDaysAgo),
      sb.from("hire_alert_candidates")
        .select("id")
        .gte("created_at", thirtyDaysAgo)
        .gte("score", 8),
    ]);

    const totalScanned = runsRes.data?.reduce((sum: number, r: any) => sum + (r.candidates_found || 0), 0) || 0;
    const newCandidates = candidatesRes.data?.length || 0;
    const hotCandidates = hotRes.data?.length || 0;

    const statsBlock = totalScanned > 0
      ? `REAL VERIFIED STATS (use these exact numbers — they are 100% real, pulled from Michigan LARA public records):
- ${newCandidates} new licensed tradespeople identified in Metro Detroit in the last 30 days
- ${hotCandidates} scored as "hot" (high availability signals)
- ${totalScanned} total license records scanned
These numbers are REAL. Do NOT round them or make them up. Use them exactly.`
      : `Our system has been actively monitoring Michigan LARA for the last 30 days. Use language like "dozens of new licenses issued monthly" — do NOT fabricate specific numbers.`;

    const origin = "https://www.detroitwebagent.com";
    const qrUrl = `${origin}/hire-alert-trial?ref=postcard&county=${targetCounty.toLowerCase()}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You write high-impact direct mail copy for a B2B hiring intelligence service called TechAlert. 
Target audience: ${audienceDesc} in ${targetCounty} County, Michigan.
Tone: urgent, direct, industrial. No fluff. No AI jargon.
CRITICAL: Every statistic you include MUST be from the real data provided. These are 100% verified numbers from Michigan LARA public records. Never fabricate or round numbers.
The QR code links to: ${qrUrl}`,
          },
          {
            role: "user",
            content: `Generate 3 postcard copy variants. Each variant has:
- copy_front: The headline (max 25 words). Must create FOMO. Reference real numbers. End with "5 FREE candidate alerts."
- copy_back: The body text (max 80 words). Explain the value, mention "100% real data from Michigan LARA public records", include the offer "5 FREE candidate alerts — no credit card required", end with "Scan the QR code."

${statsBlock}

Return as JSON array: [{"copy_front":"...","copy_back":"..."},...]
Only return the JSON array.`,
          },
        ],
        max_tokens: 1500,
      }),
    });

    let variants = [];
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        variants = JSON.parse(jsonMatch[0]);
      }
    }

    // Fallback copy if AI fails
    if (!variants.length) {
      variants = [
        {
          copy_front: `${newCandidates || "New"} licensed tradespeople entered the market in ${targetCounty} County this month. Your competitor already knows.`,
          copy_back: `TechAlert monitors Michigan LARA public records every single day — 100% real, verified data. When a new tech gets licensed in your area, you know before anyone else. ${hotCandidates > 0 ? `${hotCandidates} high-availability candidates identified this month alone.` : ""} Scan the QR code. See the live feed. 7 days free.`,
        },
      ];
    }

    // Store campaign drafts
    const inserted = [];
    for (const v of variants) {
      const { data, error } = await sb.from("postcard_campaigns").insert({
        county: targetCounty,
        copy_front: v.copy_front,
        copy_back: v.copy_back,
        qr_url: qrUrl,
        status: "draft",
        audience_type: audience,
      }).select().single();

      if (data) inserted.push(data);
    }

    return new Response(
      JSON.stringify({ success: true, variants: inserted, stats: { totalScanned, newCandidates, hotCandidates } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generate-postcard-copy] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
