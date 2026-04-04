import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Priority tiers: 1 = focus first (Matt's top services), 2 = secondary, 3 = backburner
const PRODUCT_TABLES = [
  // === TIER 1: TOP PRIORITY — focus campaigns here ===
  { table: "web_design_leads", name: "Web Design Services", price: 1499, ltv_months: 12, priority: 1, keywords: [
    "web design for small business", "affordable web design near me", "small business website design",
    "local business website builder", "web design Michigan", "web design Grosse Pointe",
    "contractor website design", "restaurant website design", "dental website design",
    "real estate agent website", "manufacturing web design", "website redesign service",
    "professional web design agency", "web designer for hire", "custom website design",
    "WordPress web design service", "business website cost", "best web design company near me",
    "web design for contractors", "web design for restaurants"
  ]},
  { table: "gbp_saas_clients", name: "GBP Auto-Poster", price: 74, ltv_months: 10, priority: 1, keywords: [
    "google business profile management", "GBP automation", "google my business posting service",
    "google business profile posts automated", "GBP post scheduler", "google my business management tool",
    "local SEO automation", "google business profile marketing", "GMB posting service",
    "google maps marketing service", "local business marketing automation"
  ]},
  { table: "social_media_clients", name: "Social Media AI", price: 199, ltv_months: 6, priority: 1, keywords: [
    "social media management service", "AI social media posts", "automated social media",
    "social media marketing for small business", "social media content creation service",
    "Facebook posting service for business", "Instagram marketing automation",
    "social media manager near me", "affordable social media management",
    "AI social media marketing", "social media for contractors"
  ]},
  { table: "blog_post_clients", name: "Blog Writer", price: 99, ltv_months: 10, priority: 1, keywords: [
    "automated blog writing service", "AI blog posts for business", "blog content service",
    "SEO blog writing service", "monthly blog posts for business", "content marketing service",
    "blog writing for small business", "AI content writer for business"
  ]},
  { table: "chatbot_clients", name: "AI Chatbot", price: 79, ltv_months: 12, priority: 1, keywords: [
    "AI chatbot for small business", "website chatbot service", "business chatbot",
    "live chat alternative for small business", "AI customer service bot",
    "chatbot for contractor website", "lead capture chatbot"
  ]},

  // === TIER 2: SMS PRODUCTS — solid recurring, expand when Tier 1 is covered ===
  { table: "review_monitor_clients", name: "Review Monitor", price: 25, ltv_months: 14, priority: 2, keywords: [
    "review monitoring service", "online review alerts", "reputation monitoring",
    "google review monitoring", "bad review alert service", "reputation management small business"
  ]},
  { table: "sms_blast_clients", name: "Weekly SMS Blast", price: 19, ltv_months: 10, priority: 2, keywords: [
    "SMS marketing service", "text message marketing", "bulk SMS for business",
    "SMS marketing for restaurants", "text blast service small business"
  ]},
  { table: "noshow_clients", name: "No-Show Re-Booker", price: 25, ltv_months: 14, priority: 2, keywords: [
    "no show appointment followup", "missed appointment text", "rebooking service",
    "appointment no show recovery", "automated rebooking text"
  ]},
  { table: "invoice_chaser_clients", name: "Invoice Chaser", price: 29, ltv_months: 12, priority: 2, keywords: [
    "invoice reminder service", "automated invoice followup", "payment reminder text",
    "overdue invoice automation", "invoice collection service small business"
  ]},
  { table: "estimate_drip_clients", name: "Estimate Follow-Up Drip", price: 39, ltv_months: 10, priority: 2, keywords: [
    "estimate follow up automation", "contractor estimate drip", "quote follow up service"
  ]},
  { table: "afterjob_drip_clients", name: "After-Job Review Drip", price: 29, ltv_months: 10, priority: 2, keywords: [
    "post job review request", "after service review automation", "review request service"
  ]},
  { table: "referral_program_clients", name: "Referral Program", price: 39, ltv_months: 12, priority: 2, keywords: [
    "referral program for small business", "automated referral rewards", "customer referral system"
  ]},
  { table: "slow_day_clients", name: "Slow Day SMS", price: 25, ltv_months: 10, priority: 2, keywords: [
    "slow day promotion text", "last minute appointment filler", "same day booking promotion"
  ]},
  { table: "homeowner_campaign_clients", name: "New Homeowner Campaign", price: 59, ltv_months: 8, priority: 2, keywords: [
    "new homeowner marketing", "new mover leads for contractors", "new homeowner mailer service"
  ]},
  { table: "promo_blaster_clients", name: "Seasonal Promo Blaster", price: 29, ltv_months: 10, priority: 2, keywords: [
    "seasonal promotion SMS", "holiday marketing automation", "seasonal text blast service"
  ]},

  // === TIER 3: BACKBURNER — lower priority, promote only if strong opportunity ===
  { table: "contractor_clients", name: "Contractor Lead Gen", price: 399, ltv_months: 8, priority: 3, keywords: [
    "contractor leads", "roofing leads", "HVAC leads", "plumber leads",
    "contractor lead generation", "exclusive contractor leads"
  ]},
  { table: "competitor_watch_clients", name: "Competitor Watch", price: 49, ltv_months: 10, priority: 3, keywords: [
    "competitor monitoring service", "competitive intelligence small business"
  ]},
  { table: "estimate_generator_clients", name: "Estimate Generator", price: 39, ltv_months: 10, priority: 3, keywords: [
    "estimate generator for contractors", "contractor estimate tool"
  ]},
  { table: "collections_clients", name: "Collections", price: 49, ltv_months: 10, priority: 3, keywords: [
    "automated collections service", "past due invoice chaser"
  ]},
];

// DataForSEO: fetch real keyword volume + CPC
async function getKeywordData(keywords: string[], login: string, password: string): Promise<Array<{ keyword: string; volume: number; cpc: number; competition: number }>> {
  const results: Array<{ keyword: string; volume: number; cpc: number; competition: number }> = [];
  
  try {
    const body = keywords.map(k => ({
      keyword: k,
      location_code: 2840, // United States
      language_code: "en",
    }));

    const res = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${login}:${password}`),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`DataForSEO error: ${res.status}`);
      return results;
    }

    const data = await res.json();
    const tasks = data?.tasks ?? [];
    for (const task of tasks) {
      for (const item of task?.result ?? []) {
        results.push({
          keyword: item.keyword ?? "",
          volume: item.search_volume ?? 0,
          cpc: item.cpc ?? 0,
          competition: item.competition ?? 0,
        });
      }
    }
  } catch (err) {
    console.error("DataForSEO fetch failed:", err);
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const dfLogin = Deno.env.get("DATAFORSEO_LOGIN") ?? "";
    const dfPassword = Deno.env.get("DATAFORSEO_PASSWORD") ?? "";

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Build business state snapshot
    const snapshot: Array<{ name: string; active: number; price: number; ltv: number; capacity: string; keywords: string[]; priority: number }> = [];

    for (const product of PRODUCT_TABLES) {
      try {
        // web_design_leads uses status instead of active boolean
        let activeCount = 0;
        if (product.table === "web_design_leads") {
          const { count } = await supabase
            .from(product.table)
            .select("*", { count: "exact", head: true })
            .in("status", ["new", "contacted", "drip"]);
          activeCount = count ?? 0;
        } else {
          const { count } = await supabase
            .from(product.table)
            .select("*", { count: "exact", head: true })
            .eq("active", true);
          activeCount = count ?? 0;
        }
        
        const ltv = product.price * product.ltv_months;
        const capacity = activeCount < 3 ? "high" : activeCount < 10 ? "medium" : "low";
        
        snapshot.push({ name: product.name, active: activeCount, price: product.price, ltv, capacity, keywords: product.keywords, priority: product.priority });
      } catch {
        // Table might not exist yet, skip
      }
    }

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

    // 3. Get REAL keyword data from DataForSEO — PRIORITY 1 services first
    const tier1 = snapshot.filter(s => s.priority === 1);
    const tier2 = snapshot.filter(s => s.priority === 2);
    const priorityKeywords = tier1.flatMap(s => s.keywords);
    // Also grab tier 2 keywords if budget allows (DataForSEO charges per keyword batch)
    const tier2Keywords = tier2.flatMap(s => s.keywords).slice(0, 15);
    const allKeywords = [...priorityKeywords, ...tier2Keywords];
    
    let keywordIntel = "";
    if (dfLogin && dfPassword && allKeywords.length > 0) {
      const kwData = await getKeywordData(allKeywords, dfLogin, dfPassword);
      if (kwData.length > 0) {
        keywordIntel = "\n\nREAL GOOGLE ADS KEYWORD DATA (from DataForSEO — actual CPC & volume):\n" +
          kwData.map(k => `• "${k.keyword}" — Volume: ${k.volume}/mo, CPC: $${k.cpc.toFixed(2)}, Competition: ${(k.competition * 100).toFixed(0)}%`)
          .join("\n");
        keywordIntel += "\n\nUSE THESE REAL CPC NUMBERS for your CAC calculations. Do NOT estimate — use the actual data above.";
      }
    } else {
      keywordIntel = "\n\n(No DataForSEO data available — use your best AI estimates for CPC)";
    }

    // 4. Use AI to analyze and generate campaign
    const tier1State = tier1
      .map(s => `⭐ [PRIORITY 1] ${s.name}: ${s.active} active clients, $${s.price}/mo, LTV $${s.ltv}, capacity: ${s.capacity}`)
      .join("\n");
    const tier2State = tier2
      .map(s => `  [PRIORITY 2] ${s.name}: ${s.active} active clients, $${s.price}/mo, LTV $${s.ltv}, capacity: ${s.capacity}`)
      .join("\n");
    const tier3State = snapshot.filter(s => s.priority === 3)
      .map(s => `  [PRIORITY 3 — BACKBURNER] ${s.name}: ${s.active} active, $${s.price}/mo`)
      .join("\n");

    const prompt = `You are Selma, a PhD economist and head marketer for M² (a B2B marketing automation agency in Grosse Pointe, Michigan).

BUSINESS STATE — TIERED BY PRIORITY:

=== TIER 1: FOCUS HERE FIRST ===
${tier1State}

=== TIER 2: SECONDARY (SMS Products) ===
${tier2State}

=== TIER 3: BACKBURNER — DO NOT PROPOSE UNLESS TIERS 1-2 HAVE NO VIABLE CAMPAIGNS ===
${tier3State}

Recent Conversions (30d): ${recentConversions ?? 0}
${keywordIntel}

TASK: Propose ONE ad campaign. You MUST pick from Tier 1 first. Only go to Tier 2 if NO Tier 1 service has a viable campaign. NEVER pick from Tier 3 unless Tiers 1 and 2 both have zero viable options.

THINK OUTSIDE THE BOX:
- Consider bundling services (e.g., "Web Design + GBP + Social Media" package deal ad)
- Consider retargeting audiences (people who visited our pages but didn't convert)
- Consider Reddit r/smallbusiness, r/entrepreneur, r/sweatystartup for B2B services
- Consider seasonal angles (spring = contractors, summer = restaurants, fall = HVAC)
- Consider local Michigan geo-targeting vs national campaigns
- Consider Facebook/Instagram lookalike audiences based on existing client profiles

RULES:
- Only propose if projected LTV > 3x projected CAC
- If real CPC data is provided, use it for precise CAC = CPC × (100 / conversion_rate%). Assume 3-5% landing page conversion rate.
- Maximum budget: $200/mo for any single campaign
- If no campaign meets the 3x threshold, respond with EXACTLY: {"no_campaign": true}

Respond in this EXACT JSON format (no markdown, ONLY valid JSON):
{
  "service": "Service Name",
  "platform": "Google|Facebook|Instagram|Reddit",
  "monthly_budget": 150,
  "target_audience": "Who to target",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "projected_cac": 45,
  "projected_ltv": 400,
  "projected_roas": 3.5,
  "campaign_content": "FULL campaign — headlines, descriptions, CTAs, targeting, bidding strategy, landing page recommendation",
  "reasoning": "Why this is the best opportunity, citing real CPC data"
}`;

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

    // 5. Validate the 3x threshold
    if (campaign.projected_ltv < campaign.projected_cac * 3) {
      return new Response(JSON.stringify({ status: "rejected", reason: "Campaign did not meet 3x LTV/CAC threshold" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 6. Insert into queue
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

    // 7. Email Matt
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
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
            <p><strong>Data Source:</strong> ${dfLogin ? "✅ Real DataForSEO CPC data" : "⚠️ AI estimates"}</p>
            <hr/>
            <p><strong>Reasoning:</strong> ${campaign.reasoning}</p>
            <hr/>
            <p style="font-size:12px;color:#666">Review and approve in your Admin Panel → Campaigns tab</p>
          </div>`,
        }),
      });
    }

    return new Response(JSON.stringify({ status: "campaign_proposed", service: campaign.service, platform: campaign.platform, data_source: dfLogin ? "dataforseo" : "ai_estimate" }), {
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