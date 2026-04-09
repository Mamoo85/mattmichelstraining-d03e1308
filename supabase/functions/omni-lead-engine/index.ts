import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Step A: Google Maps via DataForSEO
async function mapsSearch(industry: string, location: string, limit: number) {
  const login = Deno.env.get("DATAFORSEO_LOGIN") ?? "";
  const password = Deno.env.get("DATAFORSEO_PASSWORD") ?? "";
  if (!login || !password) throw new Error("DataForSEO credentials not configured");

  const res = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${login}:${password}`),
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        keyword: `${industry} near ${location}`,
        location_name: "United States",
        language_name: "English",
        depth: Math.min(limit, 100),
      },
    ]),
  });

  const data = await res.json();
  if (data?.status_code !== 20000) {
    console.error("DataForSEO error:", JSON.stringify(data?.status_message));
    // Fallback: return empty and let caller handle
    return [];
  }

  const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];
  return items
    .filter((i: any) => i.type === "maps_search")
    .slice(0, limit)
    .map((i: any) => ({
      title: i.title || "Unknown",
      rating: i.rating?.value ?? null,
      reviews: i.rating?.votes_count ?? null,
      address: i.address || null,
      phone: i.phone || null,
      website: i.url || i.domain || null,
      category: i.category || null,
      place_id: i.place_id || null,
      claimed: i.is_claimed ?? null,
    }));
}

// Step B: Firecrawl scrape a single URL
async function scrapeUrl(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY || !url) return "";
  try {
    let formatted = url.trim();
    if (!formatted.startsWith("http")) formatted = `https://${formatted}`;
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formatted,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 15000,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const md = data?.data?.markdown || data?.markdown || "";
    return md.slice(0, 3000); // Keep it manageable for enrichment
  } catch {
    return "";
  }
}

// Step C: Call the enrichment waterfall
async function enrichLead(
  domain: string,
  businessName: string,
  industry: string
): Promise<{ email: string | null; name: string | null; phone: string | null }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-enrichment-waterfall`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ domain, businessName, industry }),
    });
    if (!res.ok) return { email: null, name: null, phone: null };
    const data = await res.json();
    return {
      email: data?.email || data?.verified_email || null,
      name: data?.decision_maker_name || data?.contact_name || null,
      phone: data?.direct_phone || data?.phone || null,
    };
  } catch {
    return { email: null, name: null, phone: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Auth failed" }, 401);

    const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const { industry, location, limit = 10, strict_email_filter = true } = body;

    if (!industry) return json({ error: "Industry is required" }, 400);

    console.log(`[OmniEngine] Starting: ${industry} in ${location}, limit=${limit}, strict=${strict_email_filter}`);

    // ─── Step A: Maps Search ───
    console.log("[OmniEngine] Step A: Google Maps search...");
    const mapResults = await mapsSearch(industry, location || "Michigan", limit);
    console.log(`[OmniEngine] Step A complete: ${mapResults.length} businesses found`);

    if (mapResults.length === 0) {
      return json({ success: true, results: [], total: 0, message: "No businesses found" });
    }

    // ─── Process each lead through Steps B, C, D ───
    const processedLeads: any[] = [];
    const discarded: string[] = [];

    // Process in parallel batches of 3
    const batchSize = 3;
    for (let i = 0; i < mapResults.length; i += batchSize) {
      const batch = mapResults.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (biz: any) => {
          const domain = biz.website
            ? new URL(biz.website.startsWith("http") ? biz.website : `https://${biz.website}`).hostname
            : null;

          // ─── Step B: Firecrawl scrape ───
          let siteContent = "";
          if (biz.website) {
            siteContent = await scrapeUrl(biz.website);
          }

          // ─── Step C: Enrichment Waterfall ───
          let enrichedEmail = null;
          let enrichedName = null;
          let enrichedPhone = null;

          if (domain) {
            const enrichment = await enrichLead(domain, biz.title, industry);
            enrichedEmail = enrichment.email;
            enrichedName = enrichment.name;
            enrichedPhone = enrichment.phone;
          }

          // Use enriched data, fallback to map data
          const finalEmail = enrichedEmail;
          const finalPhone = enrichedPhone || biz.phone;
          const finalContact = enrichedName;

          // ─── Step D: Strict Email Filter ───
          if (strict_email_filter && !finalEmail) {
            return { discarded: true, name: biz.title };
          }

          return {
            discarded: false,
            lead: {
              business_name: biz.title,
              contact_name: finalContact,
              email: finalEmail,
              phone: finalPhone,
              website: biz.website,
              city: (location || "").split(",")[0]?.trim() || null,
              state: (location || "").split(",")[1]?.trim() || null,
              industry,
              google_rating: biz.rating,
              review_count: biz.reviews,
              gbp_claimed: biz.claimed,
              google_place_id: biz.place_id,
              pipeline_stage: "new_lead",
              source: "omni_engine",
              site_content_preview: siteContent.slice(0, 500),
            },
          };
        })
      );

      for (const result of batchResults) {
        if (result.discarded) {
          discarded.push(result.name);
        } else {
          processedLeads.push(result.lead);
        }
      }
    }

    // ─── Save to Pipeline ───
    let savedCount = 0;
    for (const lead of processedLeads) {
      const { site_content_preview, ...dbLead } = lead;
      const { error } = await serviceClient.from("prospect_pipeline").upsert(
        dbLead,
        { onConflict: "business_name,city" }
      );
      if (!error) savedCount++;
      else console.error("[OmniEngine] Insert error:", error.message);
    }

    console.log(
      `[OmniEngine] Complete: ${savedCount} saved, ${discarded.length} discarded (no email)`
    );

    return json({
      success: true,
      total: mapResults.length,
      saved: savedCount,
      discarded: discarded.length,
      discarded_names: discarded,
      results: processedLeads,
    });
  } catch (err) {
    console.error("[OmniEngine] Fatal error:", err);
    return json({ error: err instanceof Error ? err.message : "Engine failed" }, 500);
  }
});
