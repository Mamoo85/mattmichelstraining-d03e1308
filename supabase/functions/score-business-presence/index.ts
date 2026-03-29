import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[SCORE-PRESENCE] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

interface ScoreResult {
  total: number;
  grade: string;
  categories: { name: string; score: number; max: number; finding: string }[];
  summary: string;
  topIssues: string[];
}

function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B+";
  if (score >= 70) return "B";
  if (score >= 60) return "C+";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

async function analyzePresence(
  businessName: string,
  city: string,
  firecrawlKey: string,
  lovableKey: string
): Promise<ScoreResult> {
  // Search for the business
  let websiteContent = "";
  let websiteUrl = "";
  let hasRealWebsite = false;

  try {
    const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `"${businessName}" ${city} official website`,
        limit: 5,
      }),
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const results: any[] = searchData.data || searchData.results || [];
      for (const r of results) {
        const url: string = r.url || "";
        if (url && !url.includes("yelp.com") && !url.includes("yellowpages.com") &&
            !url.includes("facebook.com") && !url.includes("google.com")) {
          websiteUrl = url;
          websiteContent = r.markdown || r.content || r.description || "";
          hasRealWebsite = true;
          break;
        }
      }
      if (!hasRealWebsite && results.length > 0) {
        websiteContent = results[0]?.markdown || results[0]?.content || results[0]?.description || "";
        websiteUrl = results[0]?.url || "";
      }
    }
  } catch (err) {
    log("Firecrawl error", { error: String(err) });
  }

  // Score categories
  const cats = [];
  const issues: string[] = [];

  // 1. Website (0-25)
  let websiteScore = 0;
  let websiteFinding = "";
  if (!hasRealWebsite) {
    websiteScore = 0;
    websiteFinding = "No dedicated website found. You're invisible to anyone searching online.";
    issues.push("No website — competitors are getting every online lead");
  } else if (websiteContent.length < 300) {
    websiteScore = 8;
    websiteFinding = "Website exists but has very thin content — not enough for Google to rank it.";
    issues.push("Website content is too thin to rank on Google");
  } else if (!websiteContent.includes("contact") && !websiteContent.includes("call") && !websiteContent.includes("quote")) {
    websiteScore = 14;
    websiteFinding = "Website found but missing clear call-to-action — visitors don't know how to hire you.";
    issues.push("No clear 'call now' or 'get a quote' button on website");
  } else {
    websiteScore = 20;
    websiteFinding = "Website found with basic content and contact info.";
  }
  cats.push({ name: "Website", score: websiteScore, max: 25, finding: websiteFinding });

  // 2. Mobile & Speed (0-25)
  let mobileScore = 0;
  let mobileFinding = "";
  if (!hasRealWebsite) {
    mobileScore = 0;
    mobileFinding = "No website to evaluate.";
  } else if (websiteContent.includes("viewport") || websiteUrl.includes("squarespace") || websiteUrl.includes("wix")) {
    mobileScore = 16;
    mobileFinding = "Site appears mobile-friendly. Speed optimization may be needed.";
  } else {
    mobileScore = 8;
    mobileFinding = "Unable to confirm mobile optimization. 60%+ of local searches happen on phones — this matters.";
    issues.push("Mobile optimization status unknown — most customers search on their phone");
  }
  cats.push({ name: "Mobile & Speed", score: mobileScore, max: 25, finding: mobileFinding });

  // 3. Local SEO (0-25)
  let seoScore = 0;
  let seoFinding = "";
  const hasPhoneInContent = /\(\d{3}\)\s?\d{3}-\d{4}|\d{3}-\d{3}-\d{4}/.test(websiteContent);
  const hasCityMention = websiteContent.toLowerCase().includes(city.toLowerCase().split(" ")[0]);
  const hasGoogleMaps = websiteContent.toLowerCase().includes("map") || websiteContent.toLowerCase().includes("directions");

  if (!hasRealWebsite) {
    seoScore = 0;
    seoFinding = "No website = no SEO. You cannot appear in Google search results.";
    issues.push("Missing entirely from Google organic search results");
  } else {
    if (hasPhoneInContent) seoScore += 8;
    if (hasCityMention) seoScore += 8;
    if (hasGoogleMaps) seoScore += 5;
    else issues.push("Google Maps integration missing — local pack visibility is limited");
    if (seoScore < 12) seoFinding = "Local SEO signals are weak. Your site won't rank for '[service] + your city' searches.";
    else seoFinding = "Basic local SEO signals present, but likely not ranking for competitive keywords.";
  }
  cats.push({ name: "Local SEO", score: seoScore, max: 25, finding: seoFinding });

  // 4. Conversion (0-25)
  let conversionScore = 0;
  let conversionFinding = "";
  if (!hasRealWebsite) {
    conversionScore = 0;
    conversionFinding = "No website — zero online conversions possible.";
  } else {
    const hasForm = websiteContent.toLowerCase().includes("form") || websiteContent.toLowerCase().includes("submit");
    const hasTestimonials = websiteContent.toLowerCase().includes("review") || websiteContent.toLowerCase().includes("testimonial");
    const hasClickToCall = websiteContent.toLowerCase().includes("tel:") || websiteContent.toLowerCase().includes("click to call");

    if (hasForm) conversionScore += 10;
    else issues.push("No contact/quote form — visitors can't reach you 24/7");
    if (hasTestimonials) conversionScore += 8;
    else issues.push("No reviews or testimonials visible — trust signals missing");
    if (hasClickToCall) conversionScore += 7;

    conversionFinding = conversionScore >= 18
      ? "Good conversion elements in place."
      : conversionScore >= 10
        ? "Some conversion elements present but missing key trust signals."
        : "Weak conversion setup — visitors land on your site and leave without contacting you.";
  }
  cats.push({ name: "Conversion", score: conversionScore, max: 25, finding: conversionFinding });

  const total = cats.reduce((sum, c) => sum + c.score, 0);
  const grade = gradeFromScore(total);

  // AI-generated summary
  let summary = "";
  try {
    const summaryRes = await fetch("https://api.lovable.ai/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a blunt, expert local digital marketing consultant. Give short, direct, specific assessments.",
          },
          {
            role: "user",
            content: `Write a 2-sentence plain-English summary for a business owner receiving a Digital Presence Score of ${total}/100 (Grade: ${grade}).

Business: ${businessName} in ${city}
Top issues: ${issues.slice(0, 3).join("; ")}

Make it honest and specific — not fluffy. Tell them what their score means in terms of lost business.`,
          },
        ],
        temperature: 0.6,
        max_tokens: 150,
      }),
    });
    if (summaryRes.ok) {
      const data = await summaryRes.json();
      summary = data.choices?.[0]?.message?.content?.trim() || "";
    }
  } catch (err) {
    log("AI summary error", { error: String(err) });
  }

  if (!summary) {
    summary = total < 40
      ? `${businessName} has a critical online presence gap — potential customers can't find you and can't contact you easily. Every day without a fix is revenue going to competitors.`
      : `${businessName} has a partial online presence but significant gaps are costing you leads. A few targeted fixes could dramatically improve your local visibility.`;
  }

  return { total, grade, categories: cats, summary, topIssues: issues.slice(0, 4) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY || !FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "API keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { business_name, city, email } = await req.json();

    if (!business_name || !city) {
      return new Response(JSON.stringify({ error: "business_name and city are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Scoring business", { business_name, city });

    const result = await analyzePresence(business_name, city, FIRECRAWL_API_KEY, LOVABLE_API_KEY);

    // Save lead to web_design_leads if email provided
    if (email) {
      const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await serviceClient.from("web_design_leads" as any).upsert({
        name: "Business Owner",
        business: business_name,
        email: email.toLowerCase().trim(),
        phone: "",
        description: `SOURCE: presence_score | SCORE: ${result.total}/100 | GRADE: ${result.grade} | CITY: ${city}\n\nTop issues:\n${result.topIssues.map(i => `• ${i}`).join("\n")}`,
        status: "new",
        notes: `Presence score: ${result.total}/100 (${result.grade}). Submitted via /local-business-score on ${new Date().toLocaleDateString()}.`,
      }, { onConflict: "email", ignoreDuplicates: false });

      log("Lead saved", { email, score: result.total });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
