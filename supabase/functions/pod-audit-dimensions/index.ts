// Audits every pod_listings row against canonical PRINT_SPECS.
// For each Printify product, fetches print_areas, resolves the artwork image
// dimensions from /uploads/{id}.json, compares to the spec, and writes a row
// to pod_dimension_audit.
//
// Body: { listing_ids?: string[]; only_broken?: boolean }
//   - listing_ids: limit audit to these pod_listings.id values
//   - only_broken: skip writing rows for status='ok' (default false)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PRINT_SPECS } from "../_shared/pod-print-spec.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRINTIFY_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN")!;
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") || "2890106";
const UA = "Lovable-POD/1.0";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

const TOL = 2; // px tolerance
const ASPECT_TOL = 0.02; // 2% aspect ratio drift allowed

async function pf(path: string) {
  const res = await fetch(`https://api.printify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${PRINTIFY_TOKEN}`, "User-Agent": UA },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`pf_${res.status}_${path}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

interface AuditResult {
  listing_id: string;
  printify_id: string;
  product_type: string;
  expected_w: number | null;
  expected_h: number | null;
  actual_w: number | null;
  actual_h: number | null;
  bg_mode: string | null;
  status: "ok" | "wrong_dims" | "wrong_aspect" | "missing" | "no_spec" | "fetch_error";
  detail: string | null;
}

async function auditOne(row: { id: string; printify_id: string; product_type: string }): Promise<AuditResult> {
  const spec = PRINT_SPECS[row.product_type];
  if (!spec) {
    return {
      listing_id: row.id,
      printify_id: row.printify_id,
      product_type: row.product_type,
      expected_w: null, expected_h: null, actual_w: null, actual_h: null,
      bg_mode: null, status: "no_spec",
      detail: `No PRINT_SPECS entry for ${row.product_type}`,
    };
  }

  let product: any;
  try {
    product = await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${row.printify_id}.json`);
  } catch (e) {
    return {
      listing_id: row.id, printify_id: row.printify_id, product_type: row.product_type,
      expected_w: spec.width, expected_h: spec.height, actual_w: null, actual_h: null,
      bg_mode: spec.bgMode, status: "fetch_error",
      detail: (e as Error).message.slice(0, 300),
    };
  }

  // Find first placeholder matching the spec position, fallback to first non-empty.
  const areas: any[] = product?.print_areas ?? [];
  let imageId: string | null = null;
  for (const a of areas) {
    for (const ph of a.placeholders ?? []) {
      if (ph.position === spec.position && ph.images?.length) { imageId = ph.images[0].id; break; }
    }
    if (imageId) break;
  }
  if (!imageId) {
    for (const a of areas) {
      for (const ph of a.placeholders ?? []) {
        if (ph.images?.length) { imageId = ph.images[0].id; break; }
      }
      if (imageId) break;
    }
  }
  if (!imageId) {
    return {
      listing_id: row.id, printify_id: row.printify_id, product_type: row.product_type,
      expected_w: spec.width, expected_h: spec.height, actual_w: null, actual_h: null,
      bg_mode: spec.bgMode, status: "missing",
      detail: `No image placeholder found for position=${spec.position}`,
    };
  }

  let upload: any;
  try {
    upload = await pf(`/uploads/${imageId}.json`);
  } catch (e) {
    return {
      listing_id: row.id, printify_id: row.printify_id, product_type: row.product_type,
      expected_w: spec.width, expected_h: spec.height, actual_w: null, actual_h: null,
      bg_mode: spec.bgMode, status: "fetch_error",
      detail: `upload_fetch: ${(e as Error).message.slice(0, 200)}`,
    };
  }
  const w = Number(upload?.width ?? 0);
  const h = Number(upload?.height ?? 0);

  const wOk = Math.abs(w - spec.width) <= TOL;
  const hOk = Math.abs(h - spec.height) <= TOL;
  if (wOk && hOk) {
    return {
      listing_id: row.id, printify_id: row.printify_id, product_type: row.product_type,
      expected_w: spec.width, expected_h: spec.height, actual_w: w, actual_h: h,
      bg_mode: spec.bgMode, status: "ok", detail: null,
    };
  }

  // Aspect ratio classification: orientation flip / serious distortion
  const expectedAR = spec.width / spec.height;
  const actualAR = h > 0 ? w / h : 0;
  const arDrift = expectedAR > 0 ? Math.abs(actualAR - expectedAR) / expectedAR : 1;
  const isAspect = arDrift > ASPECT_TOL;

  return {
    listing_id: row.id, printify_id: row.printify_id, product_type: row.product_type,
    expected_w: spec.width, expected_h: spec.height, actual_w: w, actual_h: h,
    bg_mode: spec.bgMode, status: isAspect ? "wrong_aspect" : "wrong_dims",
    detail: `expected=${spec.width}x${spec.height} got=${w}x${h} arDrift=${arDrift.toFixed(3)}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: { listing_ids?: string[]; only_broken?: boolean } = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
  }

  let q = sb.from("pod_listings").select("id, printify_id, product_type").not("printify_id", "is", null);
  if (body.listing_ids?.length) q = q.in("id", body.listing_ids);
  const { data: rows, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const results: AuditResult[] = [];
  // Concurrency 5
  const queue = [...(rows ?? [])];
  async function worker() {
    while (queue.length) {
      const r = queue.shift();
      if (!r) break;
      try { results.push(await auditOne(r)); }
      catch (e) {
        results.push({
          listing_id: r.id, printify_id: r.printify_id, product_type: r.product_type,
          expected_w: null, expected_h: null, actual_w: null, actual_h: null,
          bg_mode: null, status: "fetch_error", detail: (e as Error).message.slice(0, 200),
        });
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker(), worker()]);

  const toWrite = body.only_broken ? results.filter(r => r.status !== "ok") : results;
  if (toWrite.length) {
    const { error: insErr } = await sb.from("pod_dimension_audit").insert(toWrite);
    if (insErr) console.error("audit insert error", insErr.message);
  }

  const summary: Record<string, number> = {};
  for (const r of results) summary[r.status] = (summary[r.status] ?? 0) + 1;

  return new Response(JSON.stringify({
    ok: true,
    audited: results.length,
    summary,
    broken: results.filter(r => r.status !== "ok" && r.status !== "no_spec"),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
