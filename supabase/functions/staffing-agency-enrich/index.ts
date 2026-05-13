// Staffing Agency Enricher — picks pending rows from queue, resolves emails
// in parallel (chunks of 8), inserts into staffing_agency_prospects.
// Designed to finish in <90s per run. Cron every 30 min.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractContactInfo } from "../_shared/firecrawl.ts";
import { hunterFindEmail } from "../_shared/hunter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const SNOV_CLIENT_ID = Deno.env.get("SNOV_CLIENT_ID") || "";
const SNOV_CLIENT_SECRET = Deno.env.get("SNOV_CLIENT_SECRET") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 24;          // pending rows per run
const PARALLEL_CHUNK = 8;       // emails resolved concurrently
const MAX_ATTEMPTS = 3;

async function snovFindEmail(domain: string): Promise<{ email: string; name: string | null } | null> {
  if (!SNOV_CLIENT_ID || !SNOV_CLIENT_SECRET || !domain) return null;
  try {
    const tokenRes = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${SNOV_CLIENT_ID}&client_secret=${SNOV_CLIENT_SECRET}`,
      signal: AbortSignal.timeout(6000),
    });
    const access = (await tokenRes.json())?.access_token;
    if (!access) return null;
    const r = await fetch(`https://api.snov.io/v2/domain-emails-with-info?domain=${encodeURIComponent(domain)}&type=all&limit=5&access_token=${access}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const emails: any[] = j?.emails || j?.data?.emails || [];
    if (!emails.length) return null;
    const titles = ["owner", "president", "founder", "ceo", "director", "manager", "recruit"];
    const pick = emails.find((e: any) => titles.some(t => (e.position || "").toLowerCase().includes(t))) || emails[0];
    if (!pick?.email) return null;
    return { email: String(pick.email).toLowerCase(), name: [pick.firstName, pick.lastName].filter(Boolean).join(" ") || null };
  } catch { return null; }
}

function domainOf(website: string | null): string | null {
  if (!website) return null;
  try {
    const u = website.startsWith("http") ? website : `https://${website}`;
    const host = new URL(u).hostname.replace(/^www\./, "");
    if (/yelp|google|facebook|instagram|linkedin|maps/i.test(host)) return null;
    return host;
  } catch { return null; }
}

// When the queue row lacks a real domain (Yelp link, no website),
// look up the agency on Google Places by name + phone to get the real website.
async function resolveRealWebsite(name: string, phone: string | null, city: string | null): Promise<string | null> {
  if (!GOOGLE_MAPS_API_KEY || !name) return null;
  try {
    const query = `${name} ${city || "Michigan"}`;
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${GOOGLE_MAPS_API_KEY}`, { signal: AbortSignal.timeout(6000) });
    const d = await r.json();
    const placeId = d?.candidates?.[0]?.place_id;
    if (!placeId) return null;
    const dr = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number&key=${GOOGLE_MAPS_API_KEY}`, { signal: AbortSignal.timeout(6000) });
    const det = (await dr.json())?.result || {};
    return det.website || null;
  } catch { return null; }
}

async function resolveEmail(website: string | null, name: string, phone: string | null, city: string | null): Promise<{ email: string; contact_name: string | null; via: string; resolved_website: string | null }> {
  let realWebsite = website;
  let domain = domainOf(website);
  if (!domain) {
    realWebsite = await resolveRealWebsite(name, phone, city);
    domain = domainOf(realWebsite);
  }
  // shadow-rebind for downstream
  if (realWebsite && domain) {
    try {
      const c = await Promise.race([
        extractContactInfo(realWebsite),
        new Promise<null>((res) => setTimeout(() => res(null), 12000)),
      ]) as any;
      if (c?.email) return { email: c.email.toLowerCase(), contact_name: c.name || null, via: "firecrawl", resolved_website: realWebsite };
    } catch { /* */ }
  }
  if (domain) {
    const h = await Promise.race([
      hunterFindEmail(domain),
      new Promise<null>((res) => setTimeout(() => res(null), 8000)),
    ]) as any;
    if (h?.email) return { email: h.email.toLowerCase(), contact_name: [h.first_name, h.last_name].filter(Boolean).join(" ") || null, via: "hunter", resolved_website: realWebsite };
  }
  if (domain) {
    const s = await snovFindEmail(domain);
    if (s) return { email: s.email, contact_name: s.name, via: "snov", resolved_website: realWebsite };
  }
  if (domain) return { email: `info@${domain}`, contact_name: null, via: "domain_fallback", resolved_website: realWebsite };
  return { email: "", contact_name: null, via: "none", resolved_website: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  try {
    const { data: pending, error } = await sb
      .from("staffing_agency_raw_queue")
      .select("*")
      .eq("enrichment_status", "pending")
      .lt("enrichment_attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;
    if (!pending?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "queue empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let inserted = 0, failed = 0, dup = 0;
    const viaCounts: Record<string, number> = {};

    for (let i = 0; i < pending.length; i += PARALLEL_CHUNK) {
      const chunk = pending.slice(i, i + PARALLEL_CHUNK);
      const results = await Promise.all(chunk.map(async (row) => {
        const { email, contact_name, via } = await resolveEmail(row.website, row.agency_name, row.phone, row.city);
        return { row, email, contact_name, via };
      }));
      // Apply DB updates serially (cheap)
      for (const { row, email, contact_name, via } of results) {
        try {
          if (!email) {
            await sb.from("staffing_agency_raw_queue").update({
              enrichment_attempts: (row.enrichment_attempts || 0) + 1,
              last_attempt_at: new Date().toISOString(),
              enrichment_status: ((row.enrichment_attempts || 0) + 1) >= MAX_ATTEMPTS ? "failed" : "pending",
              notes: "no_email_resolved",
              updated_at: new Date().toISOString(),
            }).eq("id", row.id);
            failed++;
            continue;
          }
          const domain = domainOf(row.website) || email.split("@")[1];
          const { error: upErr } = await sb.from("staffing_agency_prospects").upsert({
            agency_name: row.agency_name,
            contact_name,
            contact_title: null,
            email,
            phone: row.phone,
            city: row.city || (row.address || "").split(",")[1]?.trim() || null,
            state: row.state || "MI",
            domain,
            apollo_id: null,
            source: row.source,
            status: "new",
          }, { onConflict: "email", ignoreDuplicates: true });

          if (upErr) {
            failed++;
            console.log("prospect upsert err:", upErr.message);
          } else {
            inserted++;
            viaCounts[via] = (viaCounts[via] || 0) + 1;
          }

          await sb.from("staffing_agency_raw_queue").update({
            enrichment_status: "enriched",
            enrichment_attempts: (row.enrichment_attempts || 0) + 1,
            last_attempt_at: new Date().toISOString(),
            resolved_email: email,
            resolved_via: via,
            updated_at: new Date().toISOString(),
          }).eq("id", row.id);
        } catch (e: any) {
          failed++;
          console.log("enrich row failed:", e.message);
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true, processed: pending.length, inserted, failed, dup, via: viaCounts,
      duration_ms: Date.now() - startedAt,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("staffing-agency-enrich failed:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
