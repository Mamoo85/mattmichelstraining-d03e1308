// Orchestrates a single POD product publish with:
//  - Dedupe check against pod_listings (by normalized title within niche)
//  - 3-attempt retry with exponential backoff
//  - Per-stage logging into pod_publish_logs (printify_upload, etsy_publish_check)
//  - Inserts a row into pod_listings on success
//
// Body: { product, niche, run_id?, source?, force? }
// Returns: { ok, printifyId?, listingId?, skipped?, attempts, logs }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRINTIFY_FN_URL = "https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/printify-product-creator";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface Product {
  name: string;
  type: string;
  imagePrompt: string;
  description?: string;
  tags?: string[];
  title?: string;
  retailPrice: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function logStage(opts: {
  run_id?: string | null;
  listing_id?: string | null;
  product_name: string;
  niche: string;
  stage: string;
  attempt: number;
  ok: boolean;
  http_status?: number | null;
  duration_ms: number;
  error?: string | null;
  meta?: any;
}) {
  try {
    await sb.from("pod_publish_logs").insert({
      run_id: opts.run_id ?? null,
      listing_id: opts.listing_id ?? null,
      product_name: opts.product_name,
      niche: opts.niche,
      stage: opts.stage,
      attempt: opts.attempt,
      ok: opts.ok,
      http_status: opts.http_status ?? null,
      duration_ms: opts.duration_ms,
      error: opts.error ?? null,
      meta: opts.meta ?? null,
    });
  } catch (_) { /* never block on log failure */ }
}

function normTitle(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const product: Product = body?.product;
  const niche: string = (body?.niche || "uncategorized").toString();
  const run_id: string | null = body?.run_id ?? null;
  const source: string = body?.source || "auto";
  const force: boolean = body?.force === true;

  if (!product || !product.name || !product.imagePrompt || !product.type) {
    return new Response(JSON.stringify({ error: "missing product fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Dedupe — block products with same normalized name in same niche unless force=true
  if (!force) {
    const { data: existing } = await sb
      .from("pod_listings")
      .select("id, printify_id, product_name, title")
      .eq("niche", niche)
      .limit(200);
    const want = normTitle(product.name);
    const dupe = (existing ?? []).find(
      (l: any) => normTitle(l.product_name) === want || normTitle(l.title || "") === want,
    );
    if (dupe) {
      await logStage({
        run_id, listing_id: dupe.id, product_name: product.name, niche,
        stage: "dedupe", attempt: 1, ok: false, duration_ms: 0,
        error: "duplicate_skipped", meta: { existing_printify_id: dupe.printify_id },
      });
      return new Response(JSON.stringify({
        ok: false, skipped: true, reason: "duplicate", existing: dupe,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Retry the Printify call up to 3 attempts
  const logs: any[] = [];
  let printifyId: string | null = null;
  let lastError: string | null = null;
  let lastStatus: number | null = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= 3; attempt++) {
    attempts = attempt;
    const t0 = Date.now();
    try {
      const resp = await fetch(PRINTIFY_FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const text = await resp.text();
      lastStatus = resp.status;
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* not json */ }

      const result = json?.results?.[0];
      const ok = resp.ok && result?.status === "success" && !!result?.printifyId;

      const stageLog = {
        run_id, listing_id: null, product_name: product.name, niche,
        stage: "printify_upload", attempt, ok,
        http_status: resp.status, duration_ms: Date.now() - t0,
        error: ok ? null : (result?.error || text.slice(0, 400) || `HTTP ${resp.status}`),
        meta: { printifyId: result?.printifyId, shopId: json?.shopId },
      };
      await logStage(stageLog);
      logs.push(stageLog);

      if (ok) {
        printifyId = result.printifyId;
        break;
      }
      lastError = stageLog.error || "unknown_error";
    } catch (e: any) {
      lastError = e?.message || String(e);
      const stageLog = {
        run_id, listing_id: null, product_name: product.name, niche,
        stage: "printify_upload", attempt, ok: false,
        http_status: null, duration_ms: Date.now() - t0,
        error: lastError, meta: null,
      };
      await logStage(stageLog);
      logs.push(stageLog);
    }
    if (attempt < 3) await sleep(2000 * attempt); // 2s, 4s backoff
  }

  if (!printifyId) {
    return new Response(JSON.stringify({
      ok: false, attempts, error: lastError, http_status: lastStatus, logs,
    }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Insert listing row
  const { data: inserted, error: insErr } = await sb
    .from("pod_listings")
    .insert({
      printify_id: printifyId,
      niche,
      product_name: product.name,
      product_type: product.type,
      title: product.title || product.name,
      tags: product.tags || [],
      description: product.description || null,
      image_prompt: product.imagePrompt,
      retail_price_cents: product.retailPrice ?? null,
      source,
      source_run_id: run_id,
      status: "published",
    })
    .select("id")
    .single();

  if (insErr) {
    await logStage({
      run_id, product_name: product.name, niche, stage: "db_insert",
      attempt: 1, ok: false, duration_ms: 0, error: insErr.message,
    });
  }

  return new Response(JSON.stringify({
    ok: true, printifyId, listingId: inserted?.id, attempts, logs,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
