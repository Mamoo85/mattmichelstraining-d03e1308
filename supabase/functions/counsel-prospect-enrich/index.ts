// counsel-prospect-enrich — daily 7am ET — find owner email for prospects missing one
// Apollo people search → Hunter.io domain search → site contact-page scrape (Firecrawl)
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const HUNTER_API_KEY = Deno.env.get("HUNTER_IO_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

async function apolloFindEmail(name: string, firm?: string): Promise<{ email?: string; phone?: string; website?: string }> {
  if (!APOLLO_API_KEY) return {};
  try {
    const [first, ...rest] = name.split(/\s+/);
    const last = rest.join(" ");
    const res = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: { "X-Api-Key": APOLLO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: APOLLO_API_KEY, first_name: first, last_name: last, organization_name: firm || "" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const p = data?.person;
    if (!p?.email || /email_not_unlocked/i.test(p.email)) return {};
    return { email: p.email.toLowerCase(), phone: p.phone_numbers?.[0]?.sanitized_number, website: p.organization?.website_url };
  } catch { return {}; }
}

async function hunterFind(domain: string, name: string): Promise<string | null> {
  if (!HUNTER_API_KEY || !domain) return null;
  try {
    const [first, ...rest] = name.split(/\s+/);
    const last = rest.join(" ");
    const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&api_key=${HUNTER_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const email = data?.data?.email;
    return email && /@/.test(email) ? email.toLowerCase() : null;
  } catch { return null; }
}

async function firecrawlContact(website: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY || !website) return null;
  try {
    const tryUrls = [`${website.replace(/\/$/, "")}/contact`, `${website.replace(/\/$/, "")}/contact-us`, website];
    for (const url of tryUrls) {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"] }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const md: string = data?.data?.markdown || "";
      const m = md.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (m) return m[0].toLowerCase();
    }
    return null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: prospects } = await sb.from("counsel_search_prospects")
    .select("*")
    .is("email", null)
    .is("enriched_at", null)
    .eq("blocked", false)
    .limit(20);

  let enriched = 0, failed = 0;
  for (const p of (prospects || [])) {
    if (!p.full_name) continue;
    let email: string | null = null;
    let phone: string | null = p.owner_phone || null;
    let website: string | null = p.website || null;

    const apollo = await apolloFindEmail(p.full_name, p.firm_name);
    if (apollo.email) { email = apollo.email; phone = phone || apollo.phone || null; website = website || apollo.website || null; }
    if (!email && website) {
      const domain = website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      email = await hunterFind(domain, p.full_name);
    }
    if (!email && website) {
      email = await firecrawlContact(website);
    }

    await sb.from("counsel_search_prospects").update({
      email: email || null,
      owner_phone: phone,
      website,
      enriched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", p.id);

    if (email) enriched++; else failed++;
  }

  return new Response(JSON.stringify({ ok: true, processed: (prospects || []).length, enriched, failed }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
