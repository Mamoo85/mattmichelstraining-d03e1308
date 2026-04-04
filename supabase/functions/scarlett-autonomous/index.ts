import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scarlett focuses on NEWER products and creative angles — inverse priority from Selma
const PRODUCT_TABLES = [
  // === SCARLETT'S FOCUS: Newer SMS products + bundles ===
  { table: "review_monitor_clients", name: "Review Monitor", price: 25, ltv_months: 14, priority: 1, keywords: [
    "google review monitoring", "reputation management small business", "bad review alert",
    "online review tracker", "review response automation", "5-star review strategy"
  ]},
  { table: "noshow_clients", name: "No-Show Re-Booker", price: 25, ltv_months: 14, priority: 1, keywords: [
    "no show appointment recovery", "missed appointment followup", "rebooking automation",
    "salon no show solution", "clinic appointment recovery"
  ]},
  { table: "invoice_chaser_clients", name: "Invoice Chaser", price: 29, ltv_months: 12, priority: 1, keywords: [
    "late payment reminder", "invoice followup automation", "get paid faster",
    "contractor payment collection", "overdue invoice text message"
  ]},
  { table: "slow_day_clients", name: "Slow Day SMS", price: 25, ltv_months: 10, priority: 1, keywords: [
    "last minute appointment filler", "slow day promotion", "fill empty schedule",
    "same day booking blast", "restaurant slow night promotion"
  ]},
  { table: "referral_program_clients", name: "Referral Program", price: 39, ltv_months: 12, priority: 1, keywords: [
    "automated referral program", "referral rewards system", "word of mouth marketing tool",
    "customer referral automation", "refer a friend small business"
  ]},
  { table: "chatbot_clients", name: "AI Chatbot", price: 79, ltv_months: 12, priority: 1, keywords: [
    "AI chatbot for website", "lead capture chatbot", "24/7 customer service bot",
    "website chat widget", "AI receptionist for small business"
  ]},

  // === BUNDLE OPPORTUNITIES ===
  { table: "social_media_clients", name: "Social Media AI", price: 199, ltv_months: 6, priority: 2, keywords: [
    "social media done for you", "AI Instagram posts", "automated Facebook marketing",
    "social media for local business"
  ]},
  { table: "blog_post_clients", name: "Blog Writer", price: 99, ltv_months: 10, priority: 2, keywords: [
    "SEO blog service", "automated blog posts", "content marketing for small business"
  ]},
  { table: "web_design_leads", name: "Web Design Services", price: 1499, ltv_months: 12, priority: 2, keywords: [
    "small business website", "affordable web design", "local business website"
  ]},
  { table: "gbp_saas_clients", name: "GBP Auto-Poster", price: 74, ltv_months: 10, priority: 2, keywords: [
    "google business profile automation", "GBP posting service"
  ]},

  // === REST ===
  { table: "sms_blast_clients", name: "Weekly SMS Blast", price: 19, ltv_months: 10, priority: 3, keywords: [] },
  { table: "estimate_drip_clients", name: "Estimate Follow-Up Drip", price: 39, ltv_months: 10, priority: 3, keywords: [] },
  { table: "afterjob_drip_clients", name: "After-Job Review Drip", price: 29, ltv_months: 10, priority: 3, keywords: [] },
  { table: "homeowner_campaign_clients", name: "New Homeowner Campaign", price: 59, ltv_months: 8, priority: 3, keywords: [] },
  { table: "promo_blaster_clients", name: "Seasonal Promo Blaster", price: 29, ltv_months: 10, priority: 3, keywords: [] },
];

// DataForSEO keyword data
async function getKeywordData(keywords: string[], login: string, password: string) {
  const results: Array<{ keyword: string; volume: number; cpc: number; competition: number }> = [];
  if (!keywords.length) return results;

  try {
    const body = keywords.map(k => ({
      keyword: k,
      location_code: 2840,
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

    if (!res.ok) return results;

    const data = await res.json();
    for (const task of data?.tasks ?? []) {
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

// Bundle definitions — Scarlett's unique skill
const BUNDLES = [
  {
    name: "Digital Presence Package",
    products: ["Web Design Services", "GBP Auto-Poster", "Social Media AI"],
    bundle_price: 249,
    individual_total: 1772,
    pitch: "Everything a new business needs to look professional online — website + Google + social, all automated",
  },
  {
    name: "Reputation Fortress",
    products: ["Review Monitor", "After-Job Review Drip", "AI Chatbot"],
    bundle_price: 99,
    individual_total: 133,
    pitch: "Monitor reviews, auto-request new ones after every job, and catch leads 24/7 with AI chat",
  },
  {
    name: "Cash Flow Guardian",
    products: ["Invoice Chaser", "Estimate Follow-Up Drip", "No-Show Re-Booker"],
    bundle_price: 79,
    individual_total: 93,
    pitch: "Stop losing money — chase late invoices, follow up on estimates, and rebook no-shows automatically",
  },
  {
    name: "Customer Growth Engine",
    products: ["Referral Program", "Weekly SMS Blast", "Slow Day SMS"],
    bundle_price: 69,
    individual_total: 83,
    pitch: "Turn happy customers into new customers with referrals, stay top-of-mind with texts, fill slow days instantly",
  },
];

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

    // 1. Build business state
    const snapshot: Array<{ name: string; active: number; price: number; ltv: number; capacity: string; keywords: string[]; priority: number }> = [];

    for (const product of PRODUCT_TABLES) {
      try {
        let activeCount = 0;
        if (product.table === "web_design_leads") {
          const { count } = await supabase.from(product.table).select("*", { count: "exact", head: true }).in("status", ["new", "contacted", "drip"]);
          activeCount = count ?? 0;
        } else {
          const { count } = await supabase.from(product.table).select("*", { count: "exact", head: true }).eq("active", true);
          activeCount = count ?? 0;
        }
        const ltv = product.price * product.ltv_months;
        const capacity = activeCount < 3 ? "high" : activeCount < 10 ? "medium" : "low";
        snapshot.push({ name: product.name, active: activeCount, price: product.price, ltv, capacity, keywords: product.keywords, priority: product.priority });
      } catch { /* skip */ }
    }

    // 2. Check if Scarlett already proposed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: todayCampaigns } = await supabase
      .from("ad_campaign_queue")
      .select("service, campaign_content")
      .gte("created_at", todayStart.toISOString());

    const existingToday = todayCampaigns ?? [];
    const selmaServices = existingToday.map(c => c.service);
    const scarlettAlready = existingToday.some(c => (c.campaign_content || "").includes("[SCARLETT]"));

    if (scarlettAlready) {
      return new Response(JSON.stringify({ status: "skipped", reason: "Scarlett already proposed today" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 3. Get keyword data for Scarlett's focus areas
    const focusKeywords = snapshot.filter(s => s.priority === 1).flatMap(s => s.keywords);
    let keywordIntel = "";
    if (dfLogin && dfPassword && focusKeywords.length > 0) {
      const kwData = await getKeywordData(focusKeywords, dfLogin, dfPassword);
      if (kwData.length > 0) {
        keywordIntel = "\n\nREAL GOOGLE ADS KEYWORD DATA (DataForSEO):\n" +
          kwData.map(k => `• "${k.keyword}" — Vol: ${k.volume}/mo, CPC: $${k.cpc.toFixed(2)}, Comp: ${(k.competition * 100).toFixed(0)}%`).join("\n") +
          "\n\nUSE THESE REAL CPC NUMBERS in your CAC math.";
      }
    }

    // 4. AI Campaign Generation — GPT-5 for creative perspective
    const stateText = snapshot
      .map(s => `[P${s.priority}] ${s.name}: ${s.active} clients, $${s.price}/mo, LTV $${s.ltv}, capacity: ${s.capacity}`)
      .join("\n");

    const bundleText = BUNDLES.map(b =>
      `📦 ${b.name}: ${b.products.join(" + ")} → $${b.bundle_price}/mo (saves vs $${b.individual_total} individual)\n   Pitch: "${b.pitch}"`
    ).join("\n\n");

    const prompt = `You are Scarlett, an award-winning creative marketing director for M² — a B2B marketing automation agency in Grosse Pointe, Michigan.

You are the CREATIVE counterpart to Selma (the data economist). Your job is to bring the VISUAL and EMOTIONAL angle.

BUSINESS STATE:
${stateText}

BUNDLE OPPORTUNITIES (Scarlett's specialty — consider proposing a bundle ad):
${bundleText}

SELMA ALREADY PROPOSED TODAY FOR: ${selmaServices.length > 0 ? selmaServices.join(", ") : "Nothing yet"}
→ DO NOT propose the same service Selma already covered. Pick something different or propose a BUNDLE.

${keywordIntel}

YOUR CREATIVE SUPERPOWERS:
1. **Visual-First Thinking**: Every campaign must include an AI IMAGE PROMPT that could generate the ad creative
2. **Storytelling**: Use Problem → Solution → Result narrative arc
3. **Bundle Architect**: Consider if packaging 2-3 products together makes a stronger offer
4. **Platform-Native**: Think in Instagram carousel stories, Facebook community posts, Reddit value posts
5. **Local Angle**: Leverage "Michigan small business" and "Grosse Pointe" when it adds authenticity

CREATIVE FORMATS TO CONSIDER:
- Before/After transformation ads (show a business WITHOUT your product vs WITH it)
- "Day in the Life" showing how automation saves 2+ hours/day
- Customer pain point memes (relatable contractor/salon/restaurant frustrations)
- Carousel: "5 Things Costing Your Business Money Right Now" → each slide = a product

RULES:
- Only propose if projected LTV > 3x projected CAC
- Assume 3-5% landing page conversion rate
- Max budget: $200/mo
- If no viable campaign exists, respond EXACTLY: {"no_campaign": true}
- MUST include an ai_image_prompt field

Respond in EXACT JSON (no markdown):
{
  "service": "Service Name or Bundle Name",
  "platform": "Google|Facebook|Instagram|Reddit",
  "monthly_budget": 150,
  "target_audience": "Who to target — be specific",
  "keywords": ["keyword1", "keyword2"],
  "projected_cac": 45,
  "projected_ltv": 400,
  "projected_roas": 3.5,
  "campaign_content": "[SCARLETT] FULL campaign — headlines, descriptions, CTAs, targeting, creative concept, storytelling angle",
  "ai_image_prompt": "Detailed prompt to generate the ad image — include colors (#e8621a orange, #1e293b dark slate), composition, text overlay, style (photo-realistic vs illustrated)",
  "visual_concept": "Brief description of the visual strategy and why it will stop the scroll",
  "reasoning": "Creative rationale — why this angle will resonate emotionally with the target audience"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
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
      console.error("Scarlett: Failed to parse AI response:", cleaned);
      return new Response(JSON.stringify({ status: "error", reason: "AI response not valid JSON" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (campaign.no_campaign) {
      return new Response(JSON.stringify({ status: "no_opportunity", reason: "No campaigns met threshold" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Validate 3x threshold
    if (campaign.projected_ltv < campaign.projected_cac * 3) {
      return new Response(JSON.stringify({ status: "rejected", reason: "Did not meet 3x LTV/CAC" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Append visual concept + image prompt to campaign content
    const fullContent = `${campaign.campaign_content}\n\n` +
      `═══ VISUAL CONCEPT ═══\n${campaign.visual_concept || "N/A"}\n\n` +
      `═══ AI IMAGE PROMPT (for ad creative) ═══\n${campaign.ai_image_prompt || "N/A"}`;

    // Insert into queue
    const { error: insertError } = await supabase.from("ad_campaign_queue").insert({
      service: campaign.service,
      platform: campaign.platform,
      campaign_content: fullContent,
      projected_cac: campaign.projected_cac,
      projected_ltv: campaign.projected_ltv,
      projected_roas: campaign.projected_roas,
      monthly_budget: campaign.monthly_budget,
      target_audience: campaign.target_audience,
      keywords: campaign.keywords,
      status: "pending",
    });

    if (insertError) throw new Error(`Insert error: ${insertError.message}`);

    // Email Matt
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "Scarlett — M² Creative <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `🎨 Creative Campaign: ${campaign.service} on ${campaign.platform}`,
          html: `<div style="font-family:sans-serif;max-width:600px">
            <h2 style="color:#e8621a">🎨 Scarlett's Creative Campaign</h2>
            <p><em>A different perspective from your creative strategist</em></p>
            <p><strong>Service:</strong> ${campaign.service}</p>
            <p><strong>Platform:</strong> ${campaign.platform}</p>
            <p><strong>Budget:</strong> $${campaign.monthly_budget}/mo</p>
            <p><strong>Projected CAC:</strong> $${campaign.projected_cac}</p>
            <p><strong>Projected LTV:</strong> $${campaign.projected_ltv}</p>
            <p><strong>ROAS:</strong> ${campaign.projected_roas}x</p>
            <hr/>
            <h3>🎯 Visual Concept</h3>
            <p>${campaign.visual_concept || "See full campaign"}</p>
            <h3>🖼️ Image Prompt</h3>
            <p style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:13px">${campaign.ai_image_prompt || "N/A"}</p>
            <h3>💡 Creative Reasoning</h3>
            <p>${campaign.reasoning}</p>
            <hr/>
            <p style="font-size:12px;color:#666">Review in Admin Panel → Campaigns tab</p>
          </div>`,
        }),
      });
    }

    return new Response(JSON.stringify({
      status: "campaign_proposed",
      agent: "scarlett",
      service: campaign.service,
      platform: campaign.platform,
      data_source: dfLogin ? "dataforseo" : "ai_estimate",
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Scarlett error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
