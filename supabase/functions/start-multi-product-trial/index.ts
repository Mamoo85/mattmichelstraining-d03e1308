// start-multi-product-trial — provisions one prospect across multiple DWA products
// in a single 7-day no-card bundle. Loops start-radar-trial per product so each
// portal's native client row is created. Returns one consolidated magic-link
// summary for SMS/email use. Used for AmeriSteel-style "everything they could
// possibly use" outreach.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: corsHeaders });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const products: string[] = Array.isArray(body.products) ? body.products : [];
  if (!email || products.length === 0) {
    return new Response(JSON.stringify({ error: "email_and_products_required" }), { status: 400, headers: corsHeaders });
  }

  const results: Array<{ product: string; ok: boolean; magic_url?: string; error?: string }> = [];
  for (const product of products) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/start-radar-trial`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, product }),
      });
      const j = await r.json();
      results.push({ product, ok: !!j.ok, magic_url: j.magic_url, error: j.error });
    } catch (e: any) {
      results.push({ product, ok: false, error: e?.message || "fetch_failed" });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, email, products: results, summary_url: results.find((r) => r.ok)?.magic_url || null }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
