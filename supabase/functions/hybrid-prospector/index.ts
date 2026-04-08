import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MapBusiness {
  title: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  address: string | null;
  category: string | null;
  place_id: string | null;
  claimed: boolean | null;
}

interface HybridResult extends MapBusiness {
  gap_analysis: string | null;
  gap_status: "pending" | "analyzing" | "done" | "skipped" | "error";
}

async function analyzeGap(url: string, businessName: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://detroitwebagent.com",
      "X-Title": "Detroit Web Agency Prospector",
    },
    body: JSON.stringify({
      model: "perplexity/sonar-reasoning",
      messages: [
        {
          role: "system",
          content: `You are a sales research analyst for Detroit Web Agency. Visit the website and analyze it in ONE sentence. Look for these specific automation failures:
- Is there a visible chat widget or live chat?
- Is there a 24/7 lead capture form or booking system?
- Does the site look severely outdated (old design, broken layout, no mobile optimization)?
- Is there any after-hours call handling or missed-call text-back system visible?
- Are there visible Google reviews or testimonials?
Return ONLY one concise sentence describing the biggest automation gap you found. Example: "No chat widget or after-hours contact form — every visitor after 5pm is a lost lead."`,
        },
        {
          role: "user",
          content: `Analyze this business website for automation gaps: ${url} (Business: ${businessName})`,
        },
      ],
      max_tokens: 150,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[HYBRID] Sonar error for ${url}: ${res.status} ${errText.slice(0, 200)}`);
    throw new Error(`Sonar returned ${res.status}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "Unable to analyze";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { industry, location, limit = 10 } = await req.json();

    if (!industry || !location) {
      return new Response(
        JSON.stringify({ error: "industry and location are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "DataForSEO credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 1: DataForSEO Google Maps Search ──
    const keyword = `${industry} in ${location}`;
    console.log(`[HYBRID] Step 1: Searching "${keyword}", limit: ${limit}`);

    const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
    const mapsRes = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { keyword, location_name: location, language_code: "en", depth: Math.min(limit, 100) },
      ]),
    });

    const raw = await mapsRes.json();

    if (!mapsRes.ok || raw.status_code !== 20000) {
      console.error("[HYBRID] DataForSEO error:", JSON.stringify(raw).slice(0, 500));
      return new Response(
        JSON.stringify({ error: raw.status_message || "DataForSEO request failed", step: "dataforseo" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const items = raw.tasks?.[0]?.result?.[0]?.items || [];
    const businesses: MapBusiness[] = items
      .filter((item: any) => item.type === "maps_search" || item.type === "maps_paid" || item.type === "organic")
      .slice(0, limit)
      .map((item: any) => ({
        title: item.title || "",
        rating: item.rating?.value ?? null,
        reviews: item.rating?.votes_count ?? 0,
        address: item.address || item.address_info?.address || "",
        phone: item.phone || null,
        website: item.url || item.domain || null,
        category: item.category || "",
        place_id: item.place_id || null,
        claimed: item.is_claimed ?? null,
      }));

    console.log(`[HYBRID] Step 1 complete: ${businesses.length} businesses found`);

    // ── Step 2: Gap Analysis via OpenRouter (only for businesses with websites) ──
    const results: HybridResult[] = [];

    if (!OPENROUTER_API_KEY) {
      console.warn("[HYBRID] No OPENROUTER_API_KEY — skipping gap analysis");
      for (const b of businesses) {
        results.push({ ...b, gap_analysis: null, gap_status: "skipped" });
      }
    } else {
      const withSites = businesses.filter(b => b.website);
      const withoutSites = businesses.filter(b => !b.website);

      console.log(`[HYBRID] Step 2: Analyzing ${withSites.length} websites (${withoutSites.length} skipped — no URL)`);

      // Analyze in parallel batches of 3 to avoid rate limits
      const batchSize = 3;
      for (let i = 0; i < withSites.length; i += batchSize) {
        const batch = withSites.slice(i, i + batchSize);
        const analyses = await Promise.allSettled(
          batch.map(b => analyzeGap(b.website!, b.title))
        );

        for (let j = 0; j < batch.length; j++) {
          const result = analyses[j];
          results.push({
            ...batch[j],
            gap_analysis: result.status === "fulfilled" ? result.value : "Analysis failed — site may be blocking requests",
            gap_status: result.status === "fulfilled" ? "done" : "error",
          });
        }
      }

      // Add businesses without websites
      for (const b of withoutSites) {
        results.push({
          ...b,
          gap_analysis: "No website found — missing entire online presence. Prime candidate for web design services.",
          gap_status: "done",
        });
      }
    }

    console.log(`[HYBRID] Complete: ${results.length} results with gap analysis`);

    return new Response(
      JSON.stringify({ success: true, results, total: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[HYBRID] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
