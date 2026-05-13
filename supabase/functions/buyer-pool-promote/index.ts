// Buyer Pool Promote — drains raw_buyer_candidates, runs the existing
// email-waterfall (Snov→Apollo→Hunter→PDL→Firecrawl→free sources),
// upserts qualified rows into buyer_pools.
//
// Designed to run alongside orchestrator (cron every 30 min, offset by 15).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runEmailWaterfall } from "../_shared/email-waterfall.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH = 3; // Waterfall is heavy (Snov→Apollo→Hunter→PDL→Firecrawl + 80 free tiers); BATCH>3 trips WORKER_RESOURCE_LIMIT
const PER_CANDIDATE_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`waterfall timeout ${ms}ms`)), ms);
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

      // Run waterfall only if we have a domain or company name and no email
      if (!email && (c.domain || c.company_name)) {
        try {
          const parts = (c.contact_name || "").trim().split(/\s+/);
          const wf = await withTimeout(runEmailWaterfall(sb, {
            website: c.domain ? `https://${c.domain}` : null,
            business_name: c.company_name || null,
            city: c.city || null,
            state: c.state || null,
            contact_first_name: parts[0] || null,
            contact_last_name: parts.slice(1).join(" ") || null,
          }), PER_CANDIDATE_TIMEOUT_MS);
          email = wf?.email ?? null;
          trace = wf?.trace ?? null;
        } catch (e: any) {
          trace = { error: String(e?.message ?? e) };
        }
      }

      const quality = scoreCandidate(c, email);

      if (!email || quality < 5) {
        await sb.from("raw_buyer_candidates").update({
          enriched_at: enrichedAt,
          rejected_reason: !email ? "no_email_after_waterfall" : "low_quality",
        }).eq("id", c.id);
        rejected += 1;
        traces.push({ id: c.id, pool: c.pool, status: "rejected", quality });
        continue;
      }

      // Upsert into buyer_pools
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
        source_chain: [c.source, ...((Array.isArray(trace) ? trace : []).map((t: any) => t?.source).filter(Boolean))],
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
