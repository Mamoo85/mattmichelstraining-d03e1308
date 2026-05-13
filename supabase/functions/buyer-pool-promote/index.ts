// Buyer Pool Promote — drains raw_buyer_candidates through the FULL 110-tier
// email waterfall (site_scrape → snov → apollo → pattern_verify → hunter → pdl
// → free Tiers 7–89 → OSINT Tier 110 via OpenRouter Sonar) and upserts qualified
// rows into buyer_pools.
//
// Memory-safe shape: BATCH=3, per-candidate 25s timeout, lazy-imported extras
// inside the waterfall. Apollo is just stage 3 of 110 — when its key is dead
// the run skips it and continues.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runEmailWaterfall } from "../_shared/email-waterfall.ts";
import { openrouterCall } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH = 3;
const PER_CANDIDATE_TIMEOUT_MS = 25_000;

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

// Tier 110 — OSINT fallback via OpenRouter Sonar (web-search). Capped by
// caller via per-candidate timeout. Returns first email found in citations.
async function osintEmailLookup(c: any): Promise<string | null> {
  const company = c.company_name || c.domain;
  if (!company) return null;
  const where = [c.city, c.state].filter(Boolean).join(", ") || "United States";
  const prompt = `Find the best contact email address for "${company}" located in ${where}. ` +
    `Prefer owner/president/general-manager. Return ONLY a JSON object: ` +
    `{"email":"<email or empty>","source_url":"<url or empty>","confidence":0-100}. No prose.`;
  try {
    const res = await openrouterCall({
      model: "perplexity/sonar-pro",
      user: prompt,
      json: true,
      max_tokens: 300,
      timeout_ms: 15_000,
    });
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
        // Stages 1–109: full waterfall
        try {
          const wf = await withTimeout(
            runEmailWaterfall(sb, {
              website: c.domain ? `https://${c.domain}` : c.website || "",
              business_name: c.company_name || undefined,
              city: c.city || undefined,
              state: c.state || undefined,
              contact_first_name: c.contact_first_name || undefined,
              contact_last_name: c.contact_last_name || undefined,
            }),
            PER_CANDIDATE_TIMEOUT_MS,
            "waterfall",
          );
          if (wf?.email) {
            email = wf.email;
            source = wf.source;
            trace = wf.trace;
          } else {
            trace = wf?.trace ?? null;
          }
        } catch (e: any) {
          trace = [{ source: "waterfall", error: String(e?.message ?? e).slice(0, 160) }];
        }

        // Stage 110: OSINT fallback via OpenRouter
        if (!email) {
          const osint = await osintEmailLookup(c).catch(() => null);
          if (osint) {
            email = osint;
            source = "openrouter_osint";
            trace = [...(Array.isArray(trace) ? trace : []), { source: "openrouter_osint", ok: true }];
          }
        }
      }

      const quality = scoreCandidate(c, email);

      if (!email || quality < 5) {
        await sb.from("raw_buyer_candidates").update({
          enriched_at: enrichedAt,
          rejected_reason: !email ? "no_email_after_full_waterfall" : "low_quality",
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
