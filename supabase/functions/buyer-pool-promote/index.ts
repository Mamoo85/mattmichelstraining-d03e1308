// Buyer Pool Promote — drains raw_buyer_candidates with a LIGHTWEIGHT enrichment chain
// (Hunter.io domain search → Firecrawl contact-page scrape) and upserts qualified rows
// into buyer_pools.
//
// The full email-waterfall (80+ tiers) was too heavy for edge-runtime memory and tripped
// WORKER_RESOURCE_LIMIT even at BATCH=3. This lean version handles 10 candidates/run safely.
//
// Cron: every 30 min, offset by 15 from orchestrator.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hunterFindEmail } from "../_shared/hunter.ts";
import { firecrawlScrape, extractContactInfo } from "../_shared/firecrawl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH = 10;
const PER_CANDIDATE_TIMEOUT_MS = 12_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function scoreCandidate(c: any, emailFound: string | null): number {
  let s = 0;
  if (c.company_name) s += 1;
  if (c.domain) s += 1;
  if (c.contact_name) s += 1;
  if (c.contact_title) s += 1;
  if (emailFound) s += 4;
  if (c.contact_phone) s += 1;
  if (c.zip || c.city) s += 1;
  return Math.min(s, 10);
}

async function leanEnrich(domain: string | null, companyName: string | null): Promise<{ email: string | null; trace: any[] }> {
  const trace: any[] = [];
  if (!domain) return { email: null, trace };

  // Step 1: Hunter.io domain search
  try {
    const hunter = await withTimeout(hunterFindEmail(domain), PER_CANDIDATE_TIMEOUT_MS, "hunter");
    if (hunter?.email) {
      trace.push({ source: "hunter", email: hunter.email, score: hunter.confidence });
      return { email: hunter.email, trace };
    }
    trace.push({ source: "hunter", result: "no_match" });
  } catch (e: any) {
    trace.push({ source: "hunter", error: String(e?.message ?? e).slice(0, 120) });
  }

  // Step 2: Firecrawl contact-page scrape
  try {
    const url = `https://${domain}/contact`;
    const scraped = await withTimeout(firecrawlScrape(url), PER_CANDIDATE_TIMEOUT_MS, "firecrawl");
    if (scraped?.markdown || scraped?.html) {
      const info = extractContactInfo(scraped.markdown || scraped.html || "");
      if (info?.emails?.length) {
        // prefer non-generic emails
        const preferred = info.emails.find((e: string) => !/^(info|contact|hello|admin|support|sales)@/i.test(e)) || info.emails[0];
        trace.push({ source: "firecrawl_contact", email: preferred });
        return { email: preferred, trace };
      }
      trace.push({ source: "firecrawl_contact", result: "no_email_extracted" });
    }
  } catch (e: any) {
    trace.push({ source: "firecrawl_contact", error: String(e?.message ?? e).slice(0, 120) });
  }

  return { email: null, trace };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: candidates, error } = await sb
      .from("raw_buyer_candidates")
      .select("*")
      .is("enriched_at", null)
      .order("created_at", { ascending: true })
      .limit(BATCH);
    if (error) throw error;
    if (!candidates?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let promoted = 0;
    let rejected = 0;
    const traces: any[] = [];

    for (const c of candidates) {
      const enrichedAt = new Date().toISOString();
      let email: string | null = c.contact_email || null;
      let trace: any = null;

      if (!email && c.domain) {
        const enr = await leanEnrich(c.domain, c.company_name);
        email = enr.email;
        trace = enr.trace;
      }

      const quality = scoreCandidate(c, email);

      if (!email || quality < 5) {
        await sb.from("raw_buyer_candidates").update({
          enriched_at: enrichedAt,
          rejected_reason: !email ? "no_email_after_lean_waterfall" : "low_quality",
        }).eq("id", c.id);
        rejected += 1;
        traces.push({ id: c.id, pool: c.pool, status: "rejected", quality, trace });
        continue;
      }

      const { error: upErr } = await sb.from("buyer_pools").upsert({
        pool: c.pool,
        company_name: c.company_name || c.domain || "Unknown",
        domain: c.domain,
        contact_name: c.contact_name,
        contact_title: c.contact_title,
        contact_email: email,
        contact_phone: c.contact_phone,
        city: c.city,
        state: c.state,
        zip: c.zip,
        quality_score: quality,
        email_verified: false,
        source_chain: [c.source, ...(Array.isArray(trace) ? trace.map((t: any) => t?.source).filter(Boolean) : [])],
        enrichment_meta: { trace, raw_id: c.id },
        status: "ready",
      }, { onConflict: "contact_email", ignoreDuplicates: false });

      if (upErr) {
        await sb.from("raw_buyer_candidates").update({
          enriched_at: enrichedAt,
          rejected_reason: `upsert_error:${upErr.message}`.slice(0, 200),
        }).eq("id", c.id);
        rejected += 1;
        continue;
      }

      await sb.from("raw_buyer_candidates").update({
        enriched_at: enrichedAt,
        promoted_at: enrichedAt,
      }).eq("id", c.id);
      promoted += 1;
      traces.push({ id: c.id, pool: c.pool, status: "promoted", email, quality });
    }

    return new Response(JSON.stringify({
      ok: true,
      processed: candidates.length,
      promoted,
      rejected,
      sample: traces.slice(0, 5),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("buyer-pool-promote error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
