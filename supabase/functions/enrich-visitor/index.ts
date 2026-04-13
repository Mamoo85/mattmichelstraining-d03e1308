// enrich-visitor — 1-Click Enrichment for visitor intelligence
// Takes company_name + city, uses Firecrawl search + scrape + LLM to find owner contact info

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateJSON } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { company_name, city, visitor_event_id } = await req.json();

    if (!company_name) {
      return new Response(JSON.stringify({ error: "company_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Search for the company website via Firecrawl
    let websiteUrl = "";
    let scrapedContent = "";

    if (FIRECRAWL_API_KEY) {
      // Search for the company
      const searchQuery = `${company_name} ${city || ""} contact owner phone email`;
      const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: 3, scrapeOptions: { formats: ["markdown"] } }),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = searchData?.data || [];

        // Find the most likely company website (not yelp/facebook/etc)
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

        // If we found a website, try to scrape the contact page too
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

    // Step 2: Extract owner info via regex first
    const emailRegex = /[\w.+-]+@[\w-]+\.[\w.]+/g;
    const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const foundEmails = [...new Set((scrapedContent.match(emailRegex) || []).filter(e => !e.includes("example.com") && !e.includes("sentry")))];
    const foundPhones = [...new Set(scrapedContent.match(phoneRegex) || [])];

    // Step 3: LLM extraction for owner name + best contact
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

    // Step 4: Optionally update prospect_pipeline if visitor_event_id provided
    if (visitor_event_id && (enrichResult.owner_email || enrichResult.owner_phone)) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Check if lead already exists
      const { data: existingLead } = await sb.from("prospect_pipeline")
        .select("id")
        .ilike("business_name", company_name)
        .maybeSingle();

      if (existingLead) {
        // Update existing lead with enriched data
        await sb.from("prospect_pipeline").update({
          website: enrichResult.website || undefined,
          gap_analysis: `Enriched via SiteRadar: Owner: ${enrichResult.owner_name}, Email: ${enrichResult.owner_email}, Phone: ${enrichResult.owner_phone}. Confidence: ${enrichResult.confidence}`,
          last_activity_at: new Date().toISOString(),
        }).eq("id", existingLead.id);
      } else {
        // Create new pipeline lead
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

      // Mark visitor event as enriched
      await sb.from("crm_visitor_events").update({
        enrichment_data: {
          ...enrichResult,
          enriched_at: new Date().toISOString(),
          emails_found: foundEmails,
          phones_found: foundPhones,
        },
      }).eq("id", visitor_event_id);
    }

    console.log(`[enrich-visitor] ${company_name}: owner=${enrichResult.owner_name}, email=${enrichResult.owner_email}, confidence=${enrichResult.confidence}`);

    return new Response(JSON.stringify({
      success: true,
      ...enrichResult,
      emails_found: foundEmails,
      phones_found: foundPhones,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[enrich-visitor] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
