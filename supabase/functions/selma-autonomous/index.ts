import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCT_TABLES = [
  { table: "gbp_saas_clients", name: "GBP Auto-Poster", price: 49, ltv_months: 8 },
  { table: "blog_post_clients", name: "Blog Writer", price: 99, ltv_months: 10 },
  { table: "social_media_clients", name: "Social Media AI", price: 199, ltv_months: 6 },
  { table: "chatbot_clients", name: "AI Chatbot", price: 79, ltv_months: 12 },
  { table: "review_monitor_clients", name: "Review Monitor", price: 25, ltv_months: 14 },
  { table: "sms_blast_clients", name: "Weekly SMS Blast", price: 19, ltv_months: 10 },
  { table: "contractor_clients", name: "Contractor Lead Gen", price: 399, ltv_months: 8 },
  { table: "competitor_watch_clients", name: "Competitor Watch", price: 49, ltv_months: 10 },
  { table: "battlecard_clients", name: "Battlecards", price: 79, ltv_months: 8 },
  { table: "estimate_generator_clients", name: "Estimate Generator", price: 39, ltv_months: 10 },
  { table: "directory_submitter_clients", name: "Directory Submitter", price: 29, ltv_months: 12 },
  { table: "faq_refresh_clients", name: "FAQ Refresh", price: 29, ltv_months: 12 },
  { table: "ads_copy_clients", name: "Ads Copy", price: 49, ltv_months: 8 },
  { table: "noshow_clients", name: "No-Show Re-Booker", price: 25, ltv_months: 14 },
  { table: "invoice_chaser_clients", name: "Invoice Chaser", price: 29, ltv_months: 12 },
  { table: "collections_clients", name: "Collections", price: 49, ltv_months: 10 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Build business state snapshot
    const snapshot: Array<{ name: string; active: number; price: number; ltv: number; capacity: string }> = [];

    for (const product of PRODUCT_TABLES) {
      try {
        const { count } = await supabase
          .from(product.table)
          .select("*", { count: "exact", head: true })
          .eq("active", true);
        
        const activeCount = count ?? 0;
        const ltv = product.price * product.ltv_months;
        const capacity = activeCount < 3 ? "high" : activeCount < 10 ? "medium" : "low";
        
        snapshot.push({ name: product.name, active: activeCount, price: product.price, ltv, capacity });
      } catch {
        // Table might not exist yet, skip
      }
    }

    // Also check web design pipeline
    const { count: webDesignLeads } = await supabase
      .from("web_design_leads")
      .select("*", { count: "exact", head: true })
      .in("status", ["new", "contacted", "drip"]);

    // Check recent conversions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { count: recentConversions } = await supabase
      .from("drip_conversions")
      .select("*", { count: "exact", head: true })
      .gte("converted_at", thirtyDaysAgo);

    // 2. Check if we already proposed a campaign today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayCampaigns } = await supabase
      .from("ad_campaign_queue")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());

    if ((todayCampaigns ?? 0) > 0) {
      return new Response(JSON.stringify({ status: "skipped", reason: "Already proposed a campaign today" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 3. Use AI to analyze and generate campaign
    const businessState = snapshot
      .sort((a, b) => {
        const capacityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (capacityOrder[a.capacity] ?? 2) - (capacityOrder[b.capacity] ?? 2);
      })
      .map(s => `${s.name}: ${s.active} active clients, $${s.price}/mo, LTV $${s.ltv}, capacity: ${s.capacity}`)
      .join("\n");

    const prompt = `You are Selma, a PhD economist and head marketer for M² (a B2B marketing automation agency in Michigan).

BUSINESS STATE:
${businessState}

Web Design Pipeline: ${webDesignLeads ?? 0} active leads
Recent Conversions (30d): ${recentConversions ?? 0}

TASK: Analyze this data and determine the single best ad campaign opportunity right now.

RULES:
- Only propose if projected LTV > 3x projected CAC
- Prioritize services with HIGH capacity (few clients = room to grow)
- Consider which platforms (Google, Facebook, Instagram, Reddit) match the service best
- Be realistic with CPC estimates for Michigan/US market
- If no campaign meets the 3x threshold, respond with EXACTLY: {"no_campaign": true}

If a campaign IS viable, respond in this EXACT JSON format:
{
  "service": "Service Name",
  "platform": "Google|Facebook|Instagram|Reddit",
  "monthly_budget": 150,
  "target_audience": "Who to target",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "projected_cac": 45,
  "projected_ltv": 400,
  "projected_roas": 3.5,
  "campaign_content": "FULL campaign text here — ad copy, targeting details, headlines, descriptions, everything ready to paste into Ads Manager",
  "reasoning": "Why this is the best opportunity right now"
}

Respond with ONLY valid JSON, no markdown.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) throw new Error(`AI API error: ${aiRes.status}`);

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content || "";
    
    // Clean potential markdown wrapping
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let campaign;
    try {
      campaign = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", cleaned);
      return new Response(JSON.stringify({ status: "error", reason: "AI response not valid JSON" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (campaign.no_campaign) {
      return new Response(JSON.stringify({ status: "no_opportunity", reason: "No campaigns met the 3x LTV/CAC threshold" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 4. Validate the 3x threshold
    if (campaign.projected_ltv < campaign.projected_cac * 3) {
      return new Response(JSON.stringify({ status: "rejected", reason: "Campaign did not meet 3x LTV/CAC threshold" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 5. Insert into queue
    const { error: insertError } = await supabase.from("ad_campaign_queue").insert({
      service: campaign.service,
      platform: campaign.platform,
      campaign_content: campaign.campaign_content,
      projected_cac: campaign.projected_cac,
      projected_ltv: campaign.projected_ltv,
      projected_roas: campaign.projected_roas,
      monthly_budget: campaign.monthly_budget,
      target_audience: campaign.target_audience,
      keywords: campaign.keywords,
      status: "pending",
    });

    if (insertError) throw new Error(`Insert error: ${insertError.message}`);

    // 6. Email Matt
    if (resendKey) {
      const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
      await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({
          from: "Selma — M² Marketing <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `📊 Campaign Proposal: ${campaign.service} on ${campaign.platform}`,
          html: `<div style="font-family:sans-serif;max-width:600px">
            <h2 style="color:#e8621a">Selma's Daily Campaign Proposal</h2>
            <p><strong>Service:</strong> ${campaign.service}</p>
            <p><strong>Platform:</strong> ${campaign.platform}</p>
            <p><strong>Monthly Budget:</strong> $${campaign.monthly_budget}</p>
            <p><strong>Projected CAC:</strong> $${campaign.projected_cac}</p>
            <p><strong>Projected LTV:</strong> $${campaign.projected_ltv}</p>
            <p><strong>Projected ROAS:</strong> ${campaign.projected_roas}x</p>
            <hr/>
            <p><strong>Reasoning:</strong> ${campaign.reasoning}</p>
            <hr/>
            <p style="font-size:12px;color:#666">Review and approve in your Admin Panel → Campaigns tab</p>
          </div>`,
        }),
      });
    }

    return new Response(JSON.stringify({ status: "campaign_proposed", service: campaign.service, platform: campaign.platform }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Selma error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
