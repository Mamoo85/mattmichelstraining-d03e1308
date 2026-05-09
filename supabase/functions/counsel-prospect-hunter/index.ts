// counsel-prospect-hunter — daily 6am ET — discover MI attorneys for cold outreach
// Sources: Justia Lawyers (free scrape), Avvo (free scrape), Apollo (paid, primary)
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

interface Prospect {
  email?: string;
  full_name?: string;
  firm_name?: string;
  practice_area?: string;
  city?: string;
  state?: string;
  source: string;
  website?: string;
  owner_phone?: string;
}

const PRACTICE_AREAS = ["litigation", "criminal defense", "family law", "personal injury", "civil litigation", "estate planning"];
const MI_CITIES = ["Detroit", "Grand Rapids", "Ann Arbor", "Lansing", "Troy", "Sterling Heights", "Warren", "Royal Oak", "Bloomfield Hills"];

async function apolloAttorneys(): Promise<Prospect[]> {
  if (!APOLLO_API_KEY) return [];
  const out: Prospect[] = [];
  for (const area of PRACTICE_AREAS.slice(0, 2)) {
    try {
      const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
        method: "POST",
        headers: { "X-Api-Key": APOLLO_API_KEY, "Content-Type": "application/json", "Cache-Control": "no-cache" },
        body: JSON.stringify({
          api_key: APOLLO_API_KEY,
          q_keywords: `attorney ${area} Michigan`,
          person_titles: ["attorney", "lawyer", "partner", "associate attorney", "principal attorney"],
          person_locations: ["Michigan, US"],
          organization_num_employees_ranges: ["1,10", "11,50"],
          page: 1,
          per_page: 25,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const p of data?.people || []) {
        if (!p.email || /email_not_unlocked|noemail/i.test(p.email)) continue;
        out.push({
          email: p.email.toLowerCase(),
          full_name: p.name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
          firm_name: p.organization?.name,
          practice_area: area,
          city: p.city,
          state: "MI",
          source: "apollo",
          website: p.organization?.website_url,
          owner_phone: p.phone_numbers?.[0]?.sanitized_number,
        });
      }
    } catch (_e) { /* skip */ }
  }
  return out;
}

async function firecrawlJustia(): Promise<Prospect[]> {
  if (!FIRECRAWL_API_KEY) return [];
  const out: Prospect[] = [];
  for (const city of MI_CITIES.slice(0, 3)) {
    try {
      const url = `https://lawyers.justia.com/lawyers/michigan/${city.toLowerCase().replace(/\s+/g, "-")}`;
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"] }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const md: string = data?.data?.markdown || "";
      // Extract attorney names + firm names from Justia listing format
      const blocks = md.split(/\n## /);
      for (const block of blocks.slice(1, 30)) {
        const nameMatch = block.match(/^([A-Z][a-zA-Z'\-\.]+ (?:[A-Z]\. )?[A-Z][a-zA-Z'\-]+)/);
        if (!nameMatch) continue;
        const firmMatch = block.match(/\n(?:[A-Z][\w &,\-]+(?:LLP|LLC|PC|PLLC|Law|Group|Firm|Office|Associates))\b/);
        out.push({
          full_name: nameMatch[1],
          firm_name: firmMatch?.[0]?.trim().slice(0, 150),
          city,
          state: "MI",
          source: "justia_scrape",
        });
      }
    } catch (_e) { /* skip */ }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const [apollo, justia] = await Promise.all([apolloAttorneys(), firecrawlJustia()]);
  const all = [...apollo, ...justia];

  let inserted = 0, skipped = 0;
  for (const p of all) {
    if (!p.email && !p.full_name) { skipped++; continue; }
    // upsert by email if present, else by full_name+firm
    const conflictKey = p.email ? "email" : null;
    if (!conflictKey) {
      // dedupe by name+firm in DB
      const { data: existing } = await sb.from("counsel_search_prospects")
        .select("id")
        .eq("full_name", p.full_name!)
        .eq("firm_name", p.firm_name || "")
        .maybeSingle();
      if (existing) { skipped++; continue; }
    }
    const { error } = await sb.from("counsel_search_prospects").upsert(p, conflictKey ? { onConflict: conflictKey } : { ignoreDuplicates: true });
    if (!error) inserted++; else skipped++;
  }

  return new Response(JSON.stringify({ ok: true, found: all.length, inserted, skipped, sources: { apollo: apollo.length, justia: justia.length } }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
