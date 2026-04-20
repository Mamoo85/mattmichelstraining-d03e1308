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

// ThomasNet public search endpoints (login-free, indexable supplier listings).
// The old /suppliers/michigan/<category>-<code> URLs now redirect to a login wall —
// the public search endpoint with state=Michigan still returns supplier cards.
const DEFAULT_CATEGORY_URLS = [
  { url: "https://www.thomasnet.com/suppliers/search?cov=NA&heading=23080000&searchterm=boilers&state=Michigan&which=all", category: "boiler manufacturers" },
  { url: "https://www.thomasnet.com/suppliers/search?cov=NA&heading=91510101&searchterm=machine+shops&state=Michigan&which=all", category: "machine shops" },
  { url: "https://www.thomasnet.com/suppliers/search?cov=NA&heading=91500000&searchterm=metal+fabricators&state=Michigan&which=all", category: "metal fabricators" },
  { url: "https://www.thomasnet.com/suppliers/search?cov=NA&heading=23000000&searchterm=industrial+equipment&state=Michigan&which=all", category: "industrial equipment" },
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

  const seenCompanies = new Set<string>();
  const pushSupplier = (company: string, url: string | undefined, block: string) => {
    const cleanCompany = company.trim().replace(/^[#*\-\s]+|[#*\s]+$/g, "");
    if (!cleanCompany || cleanCompany.length < 2 || cleanCompany.length > 100) return;
    if (/thomasnet|advertise|sponsor|view profile|contact us|request (a )?quote|sign in|register|search|filter|category|subscribe|cookie|privacy|terms/i.test(cleanCompany)) return;
    const key = cleanCompany.toLowerCase();
    if (seenCompanies.has(key)) return;
    seenCompanies.add(key);
    const cityMatch = block.match(/([A-Z][a-zA-Z .'-]+),\s*(?:MI|Michigan)\b/);
    suppliers.push({
      company_name: cleanCompany,
      city: cityMatch ? cityMatch[1].trim() : undefined,
      url: url?.trim(),
      category,
    });
  };

  // Tier 1: heading-style company links (### or ##)
  const blockRegex = /(?:^|\n)#{2,4}\s*\[([^\]]+)\]\(([^)]+)\)([\s\S]*?)(?=\n#{2,4}\s|\n*$)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(markdown)) !== null) {
    pushSupplier(m[1], m[2], m[3]);
  }

  // Tier 2: bold-link pattern **[Name](url)**
  if (suppliers.length === 0) {
    const boldRegex = /\*\*\[([^\]]+)\]\(([^)]+)\)\*\*([\s\S]{0,200})/g;
    let l: RegExpExecArray | null;
    while ((l = boldRegex.exec(markdown)) !== null) {
      pushSupplier(l[1], l[2], l[3]);
    }
  }

  // Tier 3: any link to a thomasnet supplier profile (catches new layouts)
  if (suppliers.length === 0) {
    const profileRegex = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?thomasnet\.com\/profile\/[^)]+)\)([\s\S]{0,200})/gi;
    let p: RegExpExecArray | null;
    while ((p = profileRegex.exec(markdown)) !== null) {
      pushSupplier(p[1], p[2], p[3]);
    }
  }

  // Tier 4: city/state-anchored — find lines with "Name ... City, MI"
  if (suppliers.length === 0) {
    const lineRegex = /^([A-Z][A-Za-z0-9 &.,'\-]{2,80})\s+(?:[-–|•]\s+)?([A-Z][a-zA-Z .'-]+),\s*(?:MI|Michigan)\b/gm;
    let n: RegExpExecArray | null;
    while ((n = lineRegex.exec(markdown)) !== null) {
      pushSupplier(n[1], undefined, `${n[2]}, MI`);
    }
  }

  if (suppliers.length === 0) {
    console.warn(`[parser] 0 suppliers from ${category} — markdown sample (first 800 chars):\n${markdown.slice(0, 800)}`);
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
