// apify-thomasnet-pull — Firecrawl-based ThomasNet supplier scraper.
// (Original Apify actor `zen-studio~thomasnet-suppliers-scraper` returns 403 — replaced
// with direct Firecrawl scrape of ThomasNet category pages.)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stealthScrape } from "../_shared/stealth-scrape.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

// ThomasNet Michigan category landing pages (publicly indexable supplier directories)
const DEFAULT_CATEGORY_URLS = [
  { url: "https://www.thomasnet.com/suppliers/michigan/boiler-manufacturers-23080000", category: "boiler manufacturers" },
  { url: "https://www.thomasnet.com/suppliers/michigan/machine-shops-91510101", category: "machine shops" },
  { url: "https://www.thomasnet.com/suppliers/michigan/metal-fabricators-91500000", category: "metal fabricators" },
  { url: "https://www.thomasnet.com/suppliers/michigan/industrial-equipment-23000000", category: "industrial equipment" },
];

interface ScrapedSupplier {
  company_name: string;
  city?: string;
  url?: string;
  category: string;
}

async function scrapeThomasNet(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) return "";
  try {
    // Use the shared stealth scraper — auto-escalates through stealth → mobile → scroll-actions
    const result = await stealthScrape(url, {
      formats: ["markdown"],
      onlyMainContent: true,
      maxChars: 60000,
      timeoutMs: 45_000,
    });
    if (!result.ok) {
      console.error(`[thomasnet-scrape] ${url} failed: ${result.reason}`);
      return "";
    }
    return result.markdown || "";
  } catch (e) {
    console.error("[thomasnet-scrape] error:", e);
    return "";
  }
}

// Parse ThomasNet markdown — supplier blocks usually look like:
//   ### [Acme Industries](https://...)
//   Detroit, MI ... since 1947
function parseSuppliers(markdown: string, category: string): ScrapedSupplier[] {
  const suppliers: ScrapedSupplier[] = [];
  if (!markdown) return suppliers;

  // Match heading-style company links (### or ##) followed by city/state
  const blockRegex = /(?:^|\n)#{2,4}\s*\[([^\]]+)\]\(([^)]+)\)([\s\S]*?)(?=\n#{2,4}\s|\n*$)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(markdown)) !== null) {
    const company = m[1].trim();
    const url = m[2].trim();
    const block = m[3];
    if (!company || company.length < 2 || /thomasnet|advertise|sponsor/i.test(company)) continue;
    // Look for "City, MI" or "City, Michigan"
    const cityMatch = block.match(/([A-Z][a-zA-Z .'-]+),\s*(?:MI|Michigan)\b/);
    suppliers.push({
      company_name: company,
      city: cityMatch ? cityMatch[1].trim() : undefined,
      url,
      category,
    });
  }

  // Fallback: simple bold-link pattern **[Name](url)**
  if (suppliers.length === 0) {
    const linkRegex = /\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/g;
    let l: RegExpExecArray | null;
    while ((l = linkRegex.exec(markdown)) !== null) {
      const company = l[1].trim();
      if (!company || company.length < 2) continue;
      suppliers.push({ company_name: company, url: l[2].trim(), category });
    }
  }
  return suppliers;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!FIRECRAWL_API_KEY) {
    return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let body: any = {};
  try { body = await req.json(); } catch { /* default */ }

  const targets: { url: string; category: string }[] = Array.isArray(body.targets) && body.targets.length
    ? body.targets
    : DEFAULT_CATEGORY_URLS;
  const maxItems = Number(body.maxItems) || 30;

  const allSuppliers: ScrapedSupplier[] = [];
  const perCategory: Record<string, number> = {};

  for (const t of targets) {
    const md = await scrapeThomasNet(t.url);
    const list = parseSuppliers(md, t.category).slice(0, maxItems);
    perCategory[t.category] = list.length;
    allSuppliers.push(...list);
    console.log(`[thomasnet] ${t.category}: scraped ${list.length} suppliers from ${t.url}`);
  }

  // Dedupe by company_name
  const seen = new Set<string>();
  const unique = allSuppliers.filter(s => {
    const k = s.company_name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let inserted = 0;
  for (const it of unique) {
    try {
      const { error } = await sb.from("industry_pulse_signals").upsert({
        company_name: it.company_name,
        location: it.city ? `${it.city}, MI` : "Michigan",
        sector: "industrial_supplier",
        signal_type: "thomasnet_listing",
        industry: it.category,
        confidence: 6,
        source_urls: it.url ? [it.url] : null,
        recommended_pitch: `${it.company_name} listed on ThomasNet (${it.category}). Pitch TechAlert for verified licensed tradesperson hiring — boiler operators, electricians, HVAC techs.`,
        detected_at: new Date().toISOString(),
        client_tag: "techalert_prospect",
      }, { onConflict: "company_name,sector", ignoreDuplicates: false });
      if (!error) inserted++;
    } catch (err) {
      console.error("ingest thomasnet error:", err);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    items_received: unique.length,
    inserted,
    categories: targets.map(t => t.category),
    per_category: perCategory,
    source: "firecrawl",
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
