import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[PROSPECTOR] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Business categories: technically illiterate, cash-rich, motivated to spend ──
// Rotated daily so each run targets a fresh industry
const INDUSTRY_ROTATION = [
  "plumber",
  "electrician",
  "HVAC contractor",
  "roofer",
  "landscaper",
  "auto repair shop",
  "cleaning service",
  "tree service",
  "pressure washing",
  "painting contractor",
  "carpet cleaning",
  "moving company",
  "towing company",
  "locksmith",
  "pest control",
  "pool service",
  "junk removal",
  "concrete contractor",
  "deck builder",
  "fence contractor",
  "tattoo studio",
  "nail salon",
  "barber shop",
  "dog grooming",
  "catering company",
  "food truck",
  "party rental",
  "home inspector",
  "mobile mechanic",
  "chimney sweep",
];

// Cities in the Metro Detroit / Southeast Michigan area
const CITY_ROTATION = [
  "Detroit MI",
  "Grosse Pointe MI",
  "Warren MI",
  "Sterling Heights MI",
  "Livonia MI",
  "Dearborn MI",
  "Troy MI",
  "Southfield MI",
  "Pontiac MI",
  "Royal Oak MI",
];

function scoreDigitalGap(result: any): number {
  let score = 0;
  const url: string = result.url || result.metadata?.sourceURL || "";
  const content: string = result.markdown || result.content || "";

  if (!url || url.includes("facebook.com") || url.includes("yelp.com") || url.includes("yellowpages.com")) score += 35;
  else if (content.length < 500) score += 25;
  else score += 10;

  if (!content.includes("contact") && !content.includes("quote") && !content.includes("call")) score += 15;
  if (!content.includes("google") && !content.includes("maps")) score += 10;
  if (content.length < 1000) score += 15;
  if (!/\(\d{3}\)\s?\d{3}-\d{4}|\d{3}-\d{3}-\d{4}/.test(content)) score += 10;

  return Math.min(score, 95);
}

async function generateOutreachEmail(
  business: string,
  industry: string,
  city: string,
  lovableKey: string
): Promise<string> {
  const response = await fetch("https://api.lovable.ai/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are Matt Michels, a local web designer in Grosse Pointe, MI. You build sites for Metro Detroit small businesses. $499 flat, live in 7 days. Your tone is straight-talking, local, and personal — not a pitch, more like a neighbor reaching out.`,
        },
        {
          role: "user",
          content: `Write a short, punchy cold outreach email to "${business}", a ${industry} in ${city}.

Subject line + email body (under 150 words total).

Make it:
- Specific to their industry (mention a real pain they'd recognize)
- Reference that you're local (Grosse Pointe / Metro Detroit)
- Mention one real problem they probably have online (no website, hard to find on Google, losing jobs to competitors who have sites)
- Mention $499 flat, 7 days live, $49/mo
- End with: "Email me at matt@m2training.com or text (313) 806-4952 — whichever works best for you."

Do NOT use salesy language. Sound like a real person.

Format:
SUBJECT: [subject line]
---
[email body]`,
        },
      ],
      temperature: 0.75,
      max_tokens: 300,
    }),
  });

  if (!response.ok) throw new Error(`AI API error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!LOVABLE_API_KEY || !FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "API keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Auth: allow admin users OR service-role (cron) calls
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      // If a real user JWT was passed, verify admin role
      if (user) {
        const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      // If no user returned, this is a service-role/cron call — allow it to proceed
    }

    // Parse body — support day_rotation mode for cron calls
    let body: any = {};
    try { body = await req.json(); } catch { /* cron may send empty body */ }

    let { industry, city, limit = 5 } = body;

    // Day-rotation mode: pick industry + city from rotation based on today
    if (!industry) {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      industry = INDUSTRY_ROTATION[dayOfYear % INDUSTRY_ROTATION.length];
    }
    if (!city) {
      const dayOfMonth = new Date().getDate();
      city = CITY_ROTATION[dayOfMonth % CITY_ROTATION.length];
    }

    log("Starting prospecting run", { industry, city, limit });

    const searchQuery = `${industry} ${city} site:yelp.com OR site:google.com OR site:yellowpages.com`;
    const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery, limit: Math.min(limit * 2, 20) }),
    });

    if (!searchRes.ok) throw new Error(`Firecrawl search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    const results: any[] = searchData.data || searchData.results || [];
    log("Firecrawl results", { count: results.length });

    if (results.length === 0) {
      return new Response(JSON.stringify({ found: 0, queued: 0, skipped: 0, message: "No results from search" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let queued = 0;
    let skipped = 0;
    const newLeads: string[] = [];

    for (const result of results) {
      if (queued >= limit) break;

      try {
        const gapScore = scoreDigitalGap(result);
        if (gapScore < 40) { skipped++; continue; }

        const title: string = result.title || result.metadata?.title || "";
        const businessName = title.replace(/\s*[-|·].*$/, "").trim() || `${industry} in ${city}`;

        const { data: existing } = await serviceClient
          .from("web_design_leads" as any)
          .select("id")
          .ilike("business", `%${businessName.substring(0, 20)}%`)
          .limit(1);

        if (existing && existing.length > 0) { skipped++; continue; }

        const outreachEmail = await generateOutreachEmail(businessName, industry, city, LOVABLE_API_KEY);

        const lines = outreachEmail.split("\n");
        const subjectLine = lines.find(l => l.startsWith("SUBJECT:"))?.replace("SUBJECT:", "").trim()
          || `Your ${industry} business could be getting more calls`;
        const emailBody = lines.slice(lines.findIndex(l => l === "---") + 1).join("\n").trim();

        const { data: newLead, error: insertErr } = await serviceClient
          .from("web_design_leads" as any)
          .insert({
            name: "Business Owner",
            business: businessName,
            phone: "",
            email: "",
            description: `SOURCE: auto_prospected | INDUSTRY: ${industry} | CITY: ${city} | GAP_SCORE: ${gapScore} | URL: ${result.url || "none"}\n\nAUTO-GENERATED OUTREACH:\nSubject: ${subjectLine}\n\n${emailBody}`,
            status: "new",
            notes: `Auto-prospected ${new Date().toLocaleDateString()}. Gap score: ${gapScore}/100. Drip queued.`,
          })
          .select("id")
          .single();

        if (insertErr) { log("Insert error", { error: insertErr.message }); skipped++; continue; }

        queued++;
        newLeads.push(newLead.id);
        log("Lead queued", { business: businessName, gapScore, industry, city });

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        log("Error processing result", { error: String(err) });
        skipped++;
      }
    }

    log("Run complete", { found: results.length, queued, skipped, industry, city });

    return new Response(
      JSON.stringify({
        found: results.length,
        queued,
        skipped,
        leads: newLeads,
        industry,
        city,
        message: `Prospecting complete. ${queued} new ${industry} leads in ${city} added to CRM.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
