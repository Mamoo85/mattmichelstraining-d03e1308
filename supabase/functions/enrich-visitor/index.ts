// enrich-visitor — 1-Click Enrichment for visitor intelligence
// Accepts either { event_id } alone (server-side reverse lookup) OR { company_name, city, visitor_event_id }.
// IP-based company waterfall: ipinfo.io → ASN org name fallback when no company is known.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateJSON } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const IPINFO_TOKEN = Deno.env.get("IPINFO_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESIDENTIAL_HINTS = ["comcast", "spectrum", "att.net", "verizon", "t-mobile", "cox", "cable", "wireless", "broadband", "fios", "centurylink", "frontier", "xfinity"];

function isResidentialOrg(org: string): boolean {
  const o = (org || "").toLowerCase();
  return RESIDENTIAL_HINTS.some((h) => o.includes(h));
}

async function reverseIpLookup(ip: string): Promise<{ company: string; city: string; isResidential: boolean } | null> {
  if (!ip) return null;
  try {
    const url = IPINFO_TOKEN
      ? `https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`
      : `https://ipinfo.io/${ip}/json`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    // org format: "AS7922 Comcast Cable Communications, LLC"
    const orgRaw = (j.org || j.asn?.name || "").replace(/^AS\d+\s*/, "").trim();
    const isRes = isResidentialOrg(orgRaw);
    return {
      company: isRes ? "" : orgRaw,
      city: j.city || "",
      isResidential: isRes,
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    let { company_name, city, visitor_event_id, event_id } = body || {};
    // Accept either field name from the client.
    const eventId = visitor_event_id || event_id || null;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // If client sent only an event id, reverse-resolve company/city from the event row.
    if (eventId && !company_name) {
      const { data: ev } = await sb
        .from("crm_visitor_events")
        .select("id, company_name, city, ip_address")
        .eq("id", eventId)
        .maybeSingle();
      if (ev) {
        company_name = ev.company_name || "";
        city = city || ev.city || "";
        if (!company_name && ev.ip_address) {
          const lookup = await reverseIpLookup(ev.ip_address);
          if (lookup?.isResidential) {
            // Persist a structured "no match" outcome so the UI can show a tooltip and stop re-trying.
            await sb.from("crm_visitor_events").update({
              enrichment_data: {
                outcome: "residential_isp",
                isp: lookup.company || "Residential ISP",
                enriched_at: new Date().toISOString(),
              },
            }).eq("id", eventId);
            return new Response(JSON.stringify({
              success: false,
              reason: "residential_isp",
              message: "This visitor came from a residential/mobile ISP — no company can be identified.",
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (lookup?.company) {
            company_name = lookup.company;
            city = city || lookup.city || "";
          }
        }
      }
    }

    if (!company_name) {
      return new Response(JSON.stringify({
        success: false,
        reason: "no_company",
        message: "No company could be identified from this visitor.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 1: Search for the company website via Firecrawl
    let websiteUrl = "";
    let scrapedContent = "";

    if (FIRECRAWL_API_KEY) {
      const searchQuery = `${company_name} ${city || ""} contact owner phone email`;
      const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: 3, scrapeOptions: { formats: ["markdown"] } }),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = searchData?.data || [];
        const noiseHosts = ["yelp.com", "facebook.com", "linkedin.com", "yellowpages.com", "bbb.org", "mapquest.com"];
        const bestResult = results.find((r: any) => {
          try {
            const host = new URL(r.url).hostname.toLowerCase();
            return !noiseHosts.some(n => host.includes(n));
          } catch { return false; }
        }) || results[0];

        if (bestResult) {
          websiteUrl = bestResult.url || "";
          scrapedContent = bestResult.markdown || "";
        }

        if (websiteUrl) {
          try {
            const contactUrl = new URL("/contact", websiteUrl).href;
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 8000);
            const contactRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ url: contactUrl, formats: ["markdown"], onlyMainContent: true }),
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (contactRes.ok) {
              const contactData = await contactRes.json();
              const contactMd = contactData?.data?.markdown || contactData?.markdown || "";
              if (contactMd) scrapedContent += "\n\n--- CONTACT PAGE ---\n" + contactMd;
            }
          } catch { /* contact page doesn't exist or timeout — fine */ }
        }
      }
    }

    const emailRegex = /[\w.+-]+@[\w-]+\.[\w.]+/g;
    const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const foundEmails = [...new Set((scrapedContent.match(emailRegex) || []).filter(e => !e.includes("example.com") && !e.includes("sentry")))];
    const foundPhones = [...new Set(scrapedContent.match(phoneRegex) || [])];

    const enrichResult = await generateJSON<{
      owner_name: string;
      owner_email: string;
      owner_phone: string;
      website: string;
      confidence: string;
    }>(
      `Extract the business owner/manager contact info from this company page content.

Company: ${company_name}
City: ${city || "unknown"}
Website: ${websiteUrl || "not found"}

Emails found on page: ${foundEmails.join(", ") || "none"}
Phones found on page: ${foundPhones.join(", ") || "none"}

Page content:
${scrapedContent.slice(0, 3000)}

Return JSON with: owner_name, owner_email, owner_phone, website, confidence (high/medium/low).
Pick the most likely owner/decision-maker email (not info@ or support@ if a personal one exists).`,
      { owner_name: "", owner_email: foundEmails[0] || "", owner_phone: foundPhones[0] || "", website: websiteUrl, confidence: "low" },
      800
    );

    if (eventId) {
      const updates: Record<string, unknown> = {
        enrichment_data: {
          ...enrichResult,
          enriched_at: new Date().toISOString(),
          emails_found: foundEmails,
          phones_found: foundPhones,
          outcome: "enriched",
        },
      };
      // Persist company_name on the event row so the row no longer renders as "Unknown visitor".
      const eventUpdate: Record<string, unknown> = { ...updates };
      eventUpdate.company_name = company_name;
      if (city) eventUpdate.city = city;
      await sb.from("crm_visitor_events").update(eventUpdate).eq("id", eventId);

      if (enrichResult.owner_email || enrichResult.owner_phone) {
        const { data: existingLead } = await sb.from("prospect_pipeline")
          .select("id")
          .ilike("business_name", company_name)
          .maybeSingle();

        if (existingLead) {
          await sb.from("prospect_pipeline").update({
            website: enrichResult.website || undefined,
            gap_analysis: `Enriched via SiteRadar: Owner: ${enrichResult.owner_name}, Email: ${enrichResult.owner_email}, Phone: ${enrichResult.owner_phone}. Confidence: ${enrichResult.confidence}`,
            last_activity_at: new Date().toISOString(),
          }).eq("id", existingLead.id);
        } else {
          await sb.from("prospect_pipeline").insert({
            business_name: company_name,
            city: city || undefined,
            pipeline_stage: "new_lead",
            lead_score: 8,
            website: enrichResult.website || null,
            industry: "visitor_enriched",
            gap_analysis: `Enriched via SiteRadar 1-Click: Owner: ${enrichResult.owner_name}, Email: ${enrichResult.owner_email}, Phone: ${enrichResult.owner_phone}. Confidence: ${enrichResult.confidence}`,
            last_activity_at: new Date().toISOString(),
          });
        }
      }
    }

    console.log(`[enrich-visitor] ${company_name}: owner=${enrichResult.owner_name}, email=${enrichResult.owner_email}, confidence=${enrichResult.confidence}`);

    return new Response(JSON.stringify({
      success: true,
      company_name,
      city,
      ...enrichResult,
      emails_found: foundEmails,
      phones_found: foundPhones,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[enrich-visitor] Error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
