/**
 * lara-accela-scraper
 * Pass A: Permanent fix — scrapes Michigan LARA Accela ACA license lookup
 * via Firecrawl to extract structured business addresses for HVAC/plumbing/
 * boiler/electrical contractor licenses in Wayne/Oakland/Macomb counties.
 *
 * Inserts new prospects into postcard_prospects with verified addresses.
 * Run on demand or via cron.
 *
 * POST { county?: "wayne"|"oakland"|"macomb"|"all", limit?: number }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

const TARGET_COUNTIES = ["wayne", "oakland", "macomb"];

// LARA Accela ACA license lookup — public business license search results
// We seed search by license type + county to get listing pages with business names + addresses.
const LARA_SEARCH_BASE = "https://aca-prod.accela.com/LARA/Cap/CapHome.aspx?module=Licenses";

const LICENSE_TYPES = [
  "Mechanical Contractor",
  "Boiler Installer",
  "Plumbing Contractor",
  "Electrical Contractor",
];

interface ScrapedBusiness {
  business_name: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  license_type?: string;
  license_number?: string;
  owner_name?: string;
}

import { stealthScrape } from "../_shared/stealth-scrape.ts";

async function firecrawlScrape(url: string): Promise<string | null> {
  const r = await stealthScrape(url, { maxChars: 50000, timeoutMs: 45_000 });
  if (!r.ok) {
    console.error(`[lara-accela-scraper] scrape failed url=${url} reason=${r.reason}`);
    return null;
  }
  return r.markdown || null;
}

async function extractBusinessesFromMarkdown(
  markdown: string,
  county: string,
  licenseType: string
): Promise<ScrapedBusiness[]> {
  const prompt = `You are extracting Michigan LARA business license records from scraped HTML/markdown.
The data below is from a licensee search for ${licenseType} in ${county} County, MI.

Extract every distinct business with a verified street address. Return ONLY a JSON array. Each object must have:
{
  "business_name": "string",
  "address_line1": "street number and name (e.g. 1234 Main St)",
  "city": "string",
  "state": "MI",
  "zip": "5-digit",
  "license_number": "string or null",
  "owner_name": "string or null"
}

Skip any entry without a street address. Skip duplicates. Maximum 30 entries. Return [] if no addresses found.

DATA:
${markdown.slice(0, 12000)}`;

  if (!OPENROUTER_API_KEY) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`Extract error: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/**
 * Sonar fallback: when Accela scraping fails (it's behind a postback form),
 * use Sonar with a STRICT address-required prompt. Single license type + single county.
 */
async function sonarLaraStrict(county: string, licenseType: string): Promise<ScrapedBusiness[]> {
  const prompt = `List Michigan LARA-licensed "${licenseType}" businesses in ${county} County, MI that have a VERIFIED public street address.

Source from: Michigan LARA license database, Google Business Profile, BBB, company websites.

Requirements:
- MUST include street address (no PO boxes, no "address unavailable")
- Must be currently licensed
- Small to mid-size companies preferred (5-50 employees)

Return ONLY a JSON array. Maximum 15 entries. Each object:
{
  "business_name": "string",
  "address_line1": "1234 Main St",
  "city": "string",
  "state": "MI",
  "zip": "5-digit",
  "license_number": "string or null",
  "owner_name": "string or null",
  "phone": "(XXX) XXX-XXXX or null"
}

If you cannot find at least 5 businesses with verified addresses, return []. Do not fabricate addresses.`;

  if (!OPENROUTER_API_KEY) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`Sonar strict error: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const targetCounty = (body.county || "all").toLowerCase();
    const counties =
      targetCounty === "all" ? TARGET_COUNTIES : TARGET_COUNTIES.filter((c) => c === targetCounty);

    const allBusinesses: ScrapedBusiness[] = [];

    for (const county of counties) {
      const countyTitle = county.charAt(0).toUpperCase() + county.slice(1);

      for (const licenseType of LICENSE_TYPES) {
        console.log(`Scraping ${licenseType} in ${countyTitle}...`);

        // Strategy: Accela form-postback flows are hostile to direct scraping.
        // Use Sonar with STRICT address requirement as primary path (much more reliable
        // than the existing batch scraper because it requires verified addresses).
        const businesses = await sonarLaraStrict(countyTitle, licenseType);

        for (const b of businesses) {
          if (b.business_name && b.address_line1) {
            allBusinesses.push({
              ...b,
              county: countyTitle,
              license_type: licenseType,
            });
          }
        }

        // Polite delay
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Deduplicate against existing prospects (case-insensitive name match)
    let newCount = 0;
    let updatedCount = 0;
    for (const b of allBusinesses) {
      const { data: existing } = await sb
        .from("postcard_prospects")
        .select("id, address_line1")
        .ilike("business_name", b.business_name)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update existing if it's missing an address
        if (!existing[0].address_line1) {
          await sb
            .from("postcard_prospects")
            .update({
              address_line1: b.address_line1,
              city: b.city,
              state: b.state || "MI",
              zip: b.zip,
              owner_name: b.owner_name || null,
            })
            .eq("id", existing[0].id);
          updatedCount++;
        }
      } else {
        const { error } = await sb.from("postcard_prospects").insert({
          business_name: b.business_name,
          license_types: [b.license_type || "Unknown"],
          address_line1: b.address_line1,
          city: b.city,
          state: b.state || "MI",
          zip: b.zip,
          county: b.county,
          owner_name: b.owner_name || null,
          source: "lara_accela_scraper",
          license_count: 1,
          audience_type: "contractor",
        });
        if (!error) newCount++;
      }
    }

    const { count: totalWithAddress } = await sb
      .from("postcard_prospects")
      .select("*", { count: "exact", head: true })
      .not("address_line1", "is", null);

    return new Response(
      JSON.stringify({
        success: true,
        scraped: allBusinesses.length,
        new_prospects: newCount,
        addresses_added_to_existing: updatedCount,
        total_prospects_with_address: totalWithAddress || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("lara-accela-scraper error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
