import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[PROSPECTOR] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// Score a business's "digital gap" — higher = more opportunity for us
function scoreDigitalGap(result: any): number {
  let score = 0;
  const url: string = result.url || result.metadata?.sourceURL || "";
  const content: string = result.markdown || result.content || "";

  // No real website: high opportunity
  if (!url || url.includes("facebook.com") || url.includes("yelp.com") || url.includes("yellowpages.com")) score += 35;
  // Site exists but thin content
  else if (content.length < 500) score += 25;
  else score += 10;

  // Weak or missing copy signals
  if (!content.includes("contact") && !content.includes("quote") && !content.includes("call")) score += 15;
  if (!content.includes("google") && !content.includes("maps")) score += 10;
  if (content.length < 1000) score += 15;

  // No phone number visible
  if (!/\(\d{3}\)\s?\d{3}-\d{4}|\d{3}-\d{3}-\d{4}/.test(content)) score += 10;

  // Cap at 95
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
          content: `You are Matt Michels, a local web designer in Grosse Pointe, MI. You build sites for Metro Detroit contractors and small businesses. $499 flat, live in 7 days. Your tone is straight-talking, local, and personal — not a pitch, more like a neighbor reaching out.`,
        },
        {
          role: "user",
          content: `Write a short, punchy cold outreach email to "${business}", a ${industry} in ${city}.

Subject line + email body (under 150 words total).

Make it:
- Specific to their industry (not generic)
- Reference that you're local (Grosse Pointe / Metro Detroit)
- Mention one real pain point they probably have online (no website, hard to find on Google, etc.)
- Mention $499 flat, 7 days live, $49/mo
- End with a super clear CTA: text or call (313) 806-4952

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

    // Admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { industry = "contractor", city = "Detroit MI", limit = 10 } = await req.json();
    log("Starting prospecting run", { industry, city, limit });

    // Step 1: Search Firecrawl for businesses in this industry + city
    const searchQuery = `${industry} ${city} site:yelp.com OR site:google.com OR site:yellowpages.com`;
    const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery, limit: Math.min(limit, 15) }),
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

    // Step 2: Score each result and extract business info
    let queued = 0;
    let skipped = 0;
    const newLeads: string[] = [];

    for (const result of results) {
      try {
        const gapScore = scoreDigitalGap(result);
        // Only pursue businesses with significant digital gaps
        if (gapScore < 40) { skipped++; continue; }

        // Extract business name from title or URL
        const title: string = result.title || result.metadata?.title || "";
        const businessName = title.replace(/\s*[-|·].*$/, "").trim() || `${industry} business in ${city}`;

        // Check if already in our CRM (dedup by business name approximation)
        const { data: existing } = await serviceClient
          .from("web_design_leads" as any)
          .select("id")
          .ilike("business", `%${businessName.substring(0, 20)}%`)
          .limit(1);

        if (existing && existing.length > 0) { skipped++; continue; }

        // Generate personalized outreach email
        const outreachEmail = await generateOutreachEmail(businessName, industry, city, LOVABLE_API_KEY);

        // Parse subject line out of the generated email
        const lines = outreachEmail.split("\n");
        const subjectLine = lines.find(l => l.startsWith("SUBJECT:"))?.replace("SUBJECT:", "").trim() || `Your ${industry} business could be getting more calls`;
        const emailBody = lines.slice(lines.findIndex(l => l === "---") + 1).join("\n").trim();

        // Insert into web_design_leads as a new lead
        const { data: newLead, error: insertErr } = await serviceClient
          .from("web_design_leads" as any)
          .insert({
            name: "Business Owner",
            business: businessName,
            phone: "",
            email: "",
            description: `SOURCE: auto_prospected | INDUSTRY: ${industry} | CITY: ${city} | GAP_SCORE: ${gapScore} | URL: ${result.url || "none"}\n\nAUTO-GENERATED OUTREACH:\nSubject: ${subjectLine}\n\n${emailBody}`,
            status: "new",
            notes: `Auto-prospected on ${new Date().toLocaleDateString()}. Gap score: ${gapScore}/100. Drip sequence queued.`,
          })
          .select("id")
          .single();

        if (insertErr) {
          log("Insert error", { error: insertErr.message, business: businessName });
          skipped++;
          continue;
        }

        queued++;
        newLeads.push(newLead.id);
        log("Lead queued", { business: businessName, gapScore });

        // Small delay to respect Lovable API rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        log("Error processing result", { error: String(err) });
        skipped++;
      }
    }

    // Log the prospecting run to notes on admin user's profile (simple tracking)
    log("Run complete", { found: results.length, queued, skipped });

    return new Response(
      JSON.stringify({
        found: results.length,
        queued,
        skipped,
        leads: newLeads,
        message: `Prospecting complete. ${queued} new leads added to CRM, ${skipped} skipped.`,
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
