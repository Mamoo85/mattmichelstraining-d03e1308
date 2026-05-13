// Buyer Pool Promote — drains raw_buyer_candidates with a memory-safe enrichment chain:
//   Stage 1: Hunter.io domain search
//   Stage 2: Firecrawl /contact page scrape
//   Stage 3: OpenRouter Sonar OSINT (Tier 110 — web-search fallback)
//
// The full 110-tier email-waterfall blows edge-runtime memory (WORKER_RESOURCE_LIMIT)
// even at BATCH=1 because lazy-importing email-extras-1..6 cumulatively exceeds heap.
// This lean+OSINT shape stays under the limit and still escapes Apollo dependence.
//
// Cron: every 30 min, offset by 15 from orchestrator.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hunterFindEmail } from "../_shared/hunter.ts";
import { firecrawlScrape, extractContactInfo } from "../_shared/firecrawl.ts";
import { openrouterCall } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH = 8;
const PER_STAGE_TIMEOUT_MS = 10_000;

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

async function osintEmailLookup(c: any): Promise<string | null> {
  const company = c.company_name || c.domain;
  if (!company) return null;
  const where = [c.city, c.state].filter(Boolean).join(", ") || "United States";
  const prompt = `Find the best contact email address for "${company}" located in ${where}. ` +
    `Prefer owner/president/general-manager. Return ONLY a JSON object: ` +
    `{"email":"<email or empty>","confidence":0-100}. No prose.`;
  try {
    const res = await withTimeout(
      openrouterCall({
        model: "perplexity/sonar-pro",
        user: prompt,
        json: true,
        max_tokens: 250,
      }),
      PER_STAGE_TIMEOUT_MS,
      "openrouter_osint",
    );
    if (!res?.text) return null;
    const m = res.text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    const email = String(parsed.email || "").trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return email;
    return null;
  } catch {
    return null;
  }
}

async function tryFirecrawl(url: string): Promise<string | null> {
  try {
    const sc = await withTimeout(firecrawlScrape(url), PER_STAGE_TIMEOUT_MS, `firecrawl ${url}`);
    if (!sc?.markdown && !sc?.html) return null;
    const info = extractContactInfo(sc.markdown || sc.html || "");
    if (!info?.emails?.length) return null;
    const preferred = info.emails.find((e: string) => !/^(info|contact|hello|admin|support|sales|office)@/i.test(e));
    return preferred || info.emails[0];
  } catch { return null; }
}

async function leanEnrich(c: any): Promise<{ email: string | null; source: string; trace: any[] }> {
  const trace: any[] = [];
  const domain = c.domain?.replace(/^www\./, "");

  if (domain) {
    // 1. Hunter
    try {
      const h = await withTimeout(hunterFindEmail(domain), PER_STAGE_TIMEOUT_MS, "hunter");
      if (h?.email) { trace.push({ source: "hunter", ok: true }); return { email: h.email, source: "hunter", trace }; }
      trace.push({ source: "hunter", ok: false });
    } catch (e: any) { trace.push({ source: "hunter", error: String(e?.message ?? e).slice(0, 120) }); }

    // 2. Firecrawl waterfall: homepage → /contact → /about
    for (const path of ["", "/contact", "/contact-us", "/about"]) {
      const url = `https://${domain}${path}`;
      const found = await tryFirecrawl(url);
      if (found) {
        trace.push({ source: `firecrawl${path || "_home"}`, ok: true });
        return { email: found, source: `firecrawl${path || "_home"}`, trace };
      }
    }
    trace.push({ source: "firecrawl_all", ok: false });
  }

  // 3. OSINT Tier 110 — OpenRouter Sonar web-search (now with json fix)
  const osint = await osintEmailLookup(c);
  if (osint) { trace.push({ source: "openrouter_osint", ok: true }); return { email: osint, source: "openrouter_osint", trace }; }
  trace.push({ source: "openrouter_osint", ok: false });

  return { email: null, source: "none", trace };
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
      let source = "provided";
      let trace: any = null;

      if (!email) {
        const enr = await leanEnrich(c);
        email = enr.email;
        source = enr.source;
        trace = enr.trace;
      }

      const quality = scoreCandidate(c, email);

      if (!email || quality < 5) {
        await sb.from("raw_buyer_candidates").update({
          enriched_at: enrichedAt,
          rejected_reason: !email ? "no_email_after_lean_plus_osint" : "low_quality",
        }).eq("id", c.id);
        rejected += 1;
        traces.push({ id: c.id, pool: c.pool, status: "rejected", quality });
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
        source_chain: [c.source, source].filter(Boolean),
        enrichment_meta: { trace, raw_id: c.id, source },
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
      traces.push({ id: c.id, pool: c.pool, status: "promoted", email, source, quality });
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
