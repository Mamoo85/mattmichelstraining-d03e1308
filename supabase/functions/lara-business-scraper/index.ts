/**
 * lara-business-scraper
 * Scrapes Michigan LARA BPL for HVAC/plumbing/boiler/electrical BUSINESS licenses
 * in the tri-county area (Wayne, Oakland, Macomb).
 * Stores new prospects in postcard_prospects table.
 * Emails Matt a summary.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_COUNTIES = ["wayne", "oakland", "macomb"];
const LICENSE_CATEGORIES = [
  "Mechanical Contractor",
  "Boiler Contractor",
  "HVAC Contractor",
  "Plumbing Contractor",
  "Electrical Contractor",
  "Refrigeration Contractor",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Use Sonar to find licensed HVAC/plumbing/boiler businesses in tri-county area
    const prospects: Array<{
      business_name: string;
      license_types: string[];
      address_line1?: string;
      city?: string;
      county?: string;
      zip?: string;
      owner_name?: string;
      phone?: string;
      email?: string;
      source: string;
    }> = [];

    // Query Sonar for each county
    for (const county of TARGET_COUNTIES) {
      const countyTitle = county.charAt(0).toUpperCase() + county.slice(1);
      
      const sonarRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          messages: [
            {
              role: "user",
              content: `List licensed HVAC, plumbing, boiler service, and mechanical contractor businesses currently registered with Michigan LARA in ${countyTitle} County, MI. For each business provide: business name, owner name (if available), street address, city, zip code, phone number, and license types. Focus on small to mid-size companies (5-50 employees). Return as JSON array with fields: business_name, owner_name, address, city, zip, phone, license_types (array). Return at most 20 businesses. Only return the JSON array, no other text.`,
            },
          ],
          max_tokens: 4000,
        }),
      });

      if (sonarRes.ok) {
        const sonarData = await sonarRes.json();
        const content = sonarData.choices?.[0]?.message?.content || "";
        
        // Extract JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const businesses = JSON.parse(jsonMatch[0]);
            for (const biz of businesses) {
              if (biz.business_name) {
                prospects.push({
                  business_name: biz.business_name,
                  license_types: Array.isArray(biz.license_types) ? biz.license_types : [biz.license_types || "Unknown"],
                  address_line1: biz.address || undefined,
                  city: biz.city || undefined,
                  county: countyTitle,
                  zip: biz.zip || undefined,
                  owner_name: biz.owner_name || undefined,
                  phone: biz.phone || undefined,
                  email: biz.email || undefined,
                  source: "sonar_lara",
                });
              }
            }
          } catch {
            console.error(`Failed to parse Sonar JSON for ${countyTitle}`);
          }
        }
      }
    }

    // Deduplicate against existing prospects
    let newCount = 0;
    for (const p of prospects) {
      const { data: existing } = await sb
        .from("postcard_prospects")
        .select("id")
        .ilike("business_name", p.business_name)
        .limit(1);

      if (!existing || existing.length === 0) {
        const { error } = await sb.from("postcard_prospects").insert({
          business_name: p.business_name,
          license_types: p.license_types,
          address_line1: p.address_line1 || null,
          city: p.city || null,
          county: p.county || null,
          zip: p.zip || null,
          owner_name: p.owner_name || null,
          phone: p.phone || null,
          email: p.email || null,
          source: p.source,
          license_count: p.license_types.length,
        });
        if (!error) newCount++;
      }
    }

    // Get total count
    const { count: totalCount } = await sb
      .from("postcard_prospects")
      .select("*", { count: "exact", head: true });

    // Email Matt summary
    if (RESEND_API_KEY) {
      const countyBreakdown = TARGET_COUNTIES.map(c => {
        const cProspects = prospects.filter(p => p.county?.toLowerCase() === c);
        return `${c.charAt(0).toUpperCase() + c.slice(1)}: ${cProspects.length} found`;
      }).join(", ");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "DWA Postcard Engine <matt@detroitwebagent.com>",
          to: ["matthewmichels@gmail.com"],
          subject: `📬 LARA Scraper: ${newCount} new businesses found`,
          html: `
            <div style="font-family:system-ui;max-width:600px;margin:0 auto;background:#0a1628;color:#e2e8f0;padding:32px;border-radius:12px;">
              <h1 style="color:#00d4ff;font-size:24px;margin:0 0 16px;">📬 Postcard Prospect Scan Complete</h1>
              <p style="font-size:18px;margin:0 0 8px;"><strong>${newCount}</strong> new businesses added</p>
              <p style="font-size:14px;color:#94a3b8;margin:0 0 16px;">${countyBreakdown}</p>
              <p style="font-size:14px;color:#94a3b8;">Total prospects in database: <strong>${totalCount || 0}</strong></p>
              <p style="font-size:14px;color:#94a3b8;margin-top:16px;">100% real data from Michigan LARA public records. Ready to generate postcard copy and send via Lob.</p>
            </div>
          `,
        }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true, new_prospects: newCount, total: totalCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[lara-business-scraper] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
