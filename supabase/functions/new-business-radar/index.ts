// New Business Owner Radar — daily scan of Michigan SOS new LLC registrations
// Routes new Metro Detroit trade/construction/service business owners into cold outreach.
// Signals feed: (1) web design pitch for new LLC owners, (2) Contractor Leads pitch for trade LLCs,
//               (3) Mortgage Radar SBA loan angle for new self-employed owners.
// Data: Michigan LARA/CIFS business entity search + Sonar OSINT enrichment.
// Cron: daily 8am ET — see migration for schedule.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ADMIN_EMAIL = "matt@detroitwebagent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Metro Detroit ZIP code prefix list for filtering
const METRO_DETROIT_ZIPS = new Set([
  "481", "482", "483", "484", "485", "486", "487", "488", "489", // Wayne/Oakland/Macomb/Livingston
]);

const TRADE_KEYWORDS = [
  "hvac", "heating", "cooling", "air condition", "refrigerat",
  "plumb", "pipe", "mechanical",
  "electric", "wiring",
  "roofing", "roof",
  "boiler", "steam",
  "siding", "gutter",
  "insulation",
  "landscap", "lawn",
  "concrete", "masonry",
  "painting", "paint",
  "drywall", "carpent",
  "construction", "general contractor", "remodel",
];

const HIGH_TICKET_KEYWORDS = [
  "consulting", "technology", "software", "logistics", "distribution",
  "manufacturing", "medical", "dental", "health", "insurance",
  "real estate", "investment", "finance", "law", "legal",
];

interface NewBusiness {
  entity_name: string;
  entity_type: string;
  registered_agent?: string;
  city?: string;
  zip?: string;
  formation_date?: string;
  naics_description?: string;
  industry_bucket: "trade" | "high_ticket" | "general";
  source_url?: string;
}

// Sonar search for new Michigan business registrations
async function fetchNewMichiganBusinesses(): Promise<NewBusiness[]> {
  if (!LOVABLE_API_KEY) return [];
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a Michigan business registry researcher. Return ONLY valid JSON array, no prose, no markdown fences.",
          },
          {
            role: "user",
            content: `Search the Michigan LARA (Licensing and Regulatory Affairs) CIFS business entity database for new LLC and Corporation filings in Metro Detroit (Wayne, Oakland, Macomb counties) in the last 7 days. Use the public search at cofs.lara.state.mi.us or any public Michigan business registry source.

Include: entity_name, entity_type (LLC/Corp/etc), registered_agent name if shown, city, zip, formation_date (YYYY-MM-DD), source_url.

Return JSON array: [{"entity_name":"string","entity_type":"string","registered_agent":"string","city":"string","zip":"string","formation_date":"YYYY-MM-DD","source_url":"string"}]

Focus on real business names that suggest trade services, construction, or professional services. Return [] if nothing found. Maximum 30 results.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || "[]";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return [];

    return arr.map((item: any) => {
      const nameLower = (item.entity_name || "").toLowerCase();
      const isTrade = TRADE_KEYWORDS.some((kw) => nameLower.includes(kw));
      const isHighTicket = HIGH_TICKET_KEYWORDS.some((kw) => nameLower.includes(kw));
      return {
        entity_name: item.entity_name || "",
        entity_type: item.entity_type || "LLC",
        registered_agent: item.registered_agent || undefined,
        city: item.city || undefined,
        zip: typeof item.zip === "string" ? item.zip.slice(0, 5) : undefined,
        formation_date: item.formation_date || undefined,
        source_url: item.source_url || undefined,
        industry_bucket: isTrade ? "trade" : isHighTicket ? "high_ticket" : "general",
      };
    }).filter((b: NewBusiness) => b.entity_name.length > 2);
  } catch (e) {
    console.warn("[new-business-radar] Sonar fetch failed:", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// Try to find contact info for a new business via Google Maps + website scrape
async function resolveContact(business: NewBusiness): Promise<{ phone: string | null; email: string | null; website: string | null }> {
  if (!GOOGLE_MAPS_API_KEY) return { phone: null, email: null, website: null };
  try {
    const query = `${business.entity_name} ${business.city || "Metro Detroit"} Michigan`;
    const mapsRes = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "places.displayName,places.nationalPhoneNumber,places.websiteUri",
        },
        body: JSON.stringify({ textQuery: query, maxResultCount: 1, locationBias: { circle: { center: { latitude: 42.35, longitude: -83.05 }, radius: 80000 } } }),
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!mapsRes.ok) return { phone: null, email: null, website: null };
    const mapsJ = await mapsRes.json();
    const place = mapsJ?.places?.[0];
    const phone = place?.nationalPhoneNumber || null;
    const website = place?.websiteUri || null;

    // Simple email scrape from homepage
    let email: string | null = null;
    if (website) {
      try {
        const pageRes = await fetch(website, { signal: AbortSignal.timeout(5_000) });
        const html = await pageRes.text();
        const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          const candidate = emailMatch[0].toLowerCase();
          if (!candidate.includes("example") && !candidate.includes("yourdomain") && !candidate.includes("placeholder")) {
            email = candidate;
          }
        }
      } catch { /* no email */ }
    }
    return { phone, email, website };
  } catch {
    return { phone: null, email: null, website: null };
  }
}

// Build cold email for new business owner
function buildNewBusinessEmail(business: NewBusiness, contact: { phone: string | null; email: string | null; website: string | null }): string {
  const name = business.entity_name;
  const city = business.city || "Metro Detroit";
  const bucket = business.industry_bucket;

  if (bucket === "trade") {
    return `Congrats on launching ${name} — saw you just registered in Michigan. Getting the first customers is the hardest part, and I already have homeowners in ${city} looking for exactly this type of work with no contractor to send them to. We run Contractor Leads — exclusive homeowner leads for trade contractors in ${city}, one company per territory, $399/mo with your first lead within 48 hours. Reply or text (313) 992-1219 if you want to lock your city — https://www.detroitwebagent.com/contractor-leads`;
  } else if (bucket === "high_ticket") {
    return `Congrats on launching ${name} — saw you just registered in Michigan. If you're building out your online presence I'd love to show you what Detroit Web Agency does differently — we build websites that actually generate leads, not just look good. We're local, we're fast, and we do ongoing SEO and automation that most agencies don't touch. Reply or text (313) 992-1219 if you want to see examples — https://www.detroitwebagent.com`;
  } else {
    return `Congrats on launching ${name} — saw you just registered in Michigan. If you need a website or want to set up automated customer follow-up, text or call (313) 992-1219. We're Detroit Web Agency — local, fast, no contracts. https://www.detroitwebagent.com`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const runStart = new Date().toISOString();

  try {
    const businesses = await fetchNewMichiganBusinesses();
    console.log(`[new-business-radar] Found ${businesses.length} new Michigan businesses`);

    let inserted = 0;
    let emailed = 0;
    let alreadySeen = 0;
    const tradeBuckets = { trade: 0, high_ticket: 0, general: 0 };

    for (const biz of businesses) {
      if (!biz.entity_name) continue;

      // Dedup: skip if we've seen this entity in the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: existing } = await sb
        .from("industry_pulse_signals" as any)
        .select("id")
        .ilike("company_name", biz.entity_name)
        .eq("signal_type", "new_business")
        .gte("detected_at", thirtyDaysAgo)
        .limit(1);

      if (existing?.length) { alreadySeen++; continue; }

      // Insert into industry_pulse_signals so Growth Radar and contractor-prospector both see it
      await sb.from("industry_pulse_signals" as any).insert({
        company_name: biz.entity_name,
        location: biz.city ? `${biz.city}, MI` : "Metro Detroit, MI",
        industry: biz.industry_bucket === "trade" ? "Trade Services" : biz.industry_bucket === "high_ticket" ? "Professional Services" : "General Services",
        signal_type: "new_business",
        confidence: biz.industry_bucket === "trade" ? 8 : 6,
        recommended_pitch: buildNewBusinessEmail(biz, { phone: null, email: null, website: null }),
        source_urls: biz.source_url ? [biz.source_url] : [],
        detected_at: new Date().toISOString(),
        hiring_roles: [],
        predicted_needs: biz.industry_bucket === "trade" ? ["Contractor Leads", "Web Design", "TechAlert"] : ["Web Design", "SEO"],
        cross_referenced: false,
      });
      inserted++;
      tradeBuckets[biz.industry_bucket]++;

      // Attempt contact resolution + email send (max 5 emails/day from this function)
      if (emailed < 5) {
        const contact = await resolveContact(biz);
        if (contact.email) {
          const body = buildNewBusinessEmail(biz, contact);
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@detroitwebagent.com>",
              to: [contact.email],
              bcc: [ADMIN_EMAIL],
              subject: `congrats on ${biz.entity_name} — quick note`,
              text: body,
            }),
            signal: AbortSignal.timeout(8_000),
          });
          if (emailRes.ok) {
            emailed++;
            await sb.from("email_send_log" as any).insert({
              recipient_email: contact.email,
              template_name: "new_business_radar_d0",
              status: "sent",
              message_id: `nbr_${Date.now()}_${contact.email}`,
            });
            await sb.from("outreach_leads" as any).insert({
              business_name: biz.entity_name,
              city: biz.city || "Metro Detroit",
              industry: biz.industry_bucket,
              email: contact.email,
              phone: contact.phone,
              website: contact.website,
              status: "emailed",
              channel: "email",
              offer_pitched: biz.industry_bucket === "trade" ? "contractor_leads" : "web_design",
              last_contact_date: new Date().toISOString().slice(0, 10),
              notes: `New Business Radar: ${biz.entity_type} registered ${biz.formation_date || "recently"}`,
            });
          }
        }
      }
    }

    // SMS Matt with daily summary
    if (inserted > 0) {
      await sendSMS(
        ADMIN_PHONE, TWILIO_PHONE,
        `🆕 New Business Radar: ${inserted} new Metro Detroit businesses today. Trade: ${tradeBuckets.trade}, High-ticket: ${tradeBuckets.high_ticket}, General: ${tradeBuckets.general}. ${emailed} emails sent.`,
        "new_business_radar"
      ).catch(() => {});
    }

    // Heartbeat
    await sb.from("agent_heartbeats" as any).upsert(
      { agent_name: "new-business-radar", last_beat: new Date().toISOString(), metadata: { inserted, emailed, alreadySeen, run_at: runStart } },
      { onConflict: "agent_name" }
    );

    return new Response(JSON.stringify({
      ok: true,
      run_at: runStart,
      businesses_found: businesses.length,
      inserted,
      emailed,
      already_seen: alreadySeen,
      trade_buckets: tradeBuckets,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[new-business-radar] Fatal error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
