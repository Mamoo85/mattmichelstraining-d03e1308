// GNG Supply-Chain Audit: pulls Printify catalog, diffs against Etsy, classifies every listing,
// records a run, and returns the verdict + buckets. Admin-only via service-role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRINTIFY_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN") || Deno.env.get("PRINTIFY_API_KEY");
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID");

const PF_API = "https://api.printify.com/v1";

async function pf(path: string): Promise<any> {
  const r = await fetch(`${PF_API}${path}`, {
    headers: { Authorization: `Bearer ${PRINTIFY_TOKEN}`, "User-Agent": "GNG-Audit/1.0" },
  });
  if (!r.ok) throw new Error(`Printify ${r.status} ${path}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function listAllPrintify(): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (page <= 50) {
    const data = await pf(`/shops/${PRINTIFY_SHOP_ID}/products.json?limit=50&page=${page}`);
    const items = data?.data ?? [];
    all.push(...items);
    if (items.length < 50) break;
    page++;
  }
  return all;
}

function cheapestVariant(p: any): { retail: number; cost: number } {
  const enabled = (p.variants ?? []).filter((v: any) => v.is_enabled);
  if (!enabled.length) return { retail: 0, cost: 0 };
  const min = enabled.reduce((m: any, v: any) => (v.price < m.price ? v : m), enabled[0]);
  return { retail: Number(min.price) || 0, cost: Number(min.cost) || 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!PRINTIFY_TOKEN || !PRINTIFY_SHOP_ID) {
      return new Response(JSON.stringify({ error: "Missing PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---- 1. Pull Printify catalog ----
    const pfProducts = await listAllPrintify();

    // ---- 2. Upsert into printify_products ----
    const rows = pfProducts.map((p: any) => {
      const { retail, cost } = cheapestVariant(p);
      const etsy_listing_id = p.external?.id ? Number(p.external.id) : null;
      return {
        product_id: p.id,
        shop_id: String(PRINTIFY_SHOP_ID),
        blueprint_id: p.blueprint_id ?? null,
        print_provider_id: p.print_provider_id ?? null,
        title: p.title ?? null,
        description: (p.description ?? "").slice(0, 4000),
        tags: p.tags ?? [],
        retail_cents: Math.round(retail),
        cost_cents: Math.round(cost),
        profit_cents: Math.round(retail - cost),
        etsy_listing_id,
        visible: !!p.visible,
        is_locked: !!p.is_locked,
        published_to_etsy: !!etsy_listing_id,
        pf_updated_at: p.updated_at ?? null,
        raw: { id: p.id, external: p.external, sales_channel_properties: p.sales_channel_properties },
        synced_at: new Date().toISOString(),
      };
    });

    // chunked upsert
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await sb.from("printify_products").upsert(chunk, { onConflict: "product_id" });
      if (error) throw new Error(`upsert printify_products: ${error.message}`);
    }

    // ---- 3. Pull active Etsy listings ----
    const { data: etsy } = await sb
      .from("etsy_products")
      .select("listing_id,title,price_cents,state,etsy_updated_ts")
      .eq("state", "active");
    const etsyById = new Map<number, any>((etsy ?? []).map((e: any) => [Number(e.listing_id), e]));

    // ---- 4. Bucket every Printify product ----
    const buckets = {
      synced: [] as any[],
      price_drift: [] as any[],
      orphan_printify: [] as any[],
      orphan_etsy: [] as any[],
      margin_thin: [] as any[],
    };
    let drift_dollars = 0;
    let pf_newer_than_etsy = 0;
    let etsy_newer_than_pf = 0;

    for (const r of rows) {
      // margin check
      if (r.retail_cents > 0) {
        const fees = r.retail_cents * 0.135 + 20; // Etsy ~13.5% take + $0.20
        const margin = (r.retail_cents - r.cost_cents - fees) / r.retail_cents;
        if (margin < 0.30) buckets.margin_thin.push({ id: r.product_id, title: r.title, margin: +(margin * 100).toFixed(1), retail: r.retail_cents / 100, cost: r.cost_cents / 100 });
      }

      if (!r.etsy_listing_id) {
        buckets.orphan_printify.push({ id: r.product_id, title: r.title });
        continue;
      }
      const e = etsyById.get(Number(r.etsy_listing_id));
      if (!e) {
        buckets.orphan_printify.push({ id: r.product_id, title: r.title, note: "linked etsy_listing_id not in active Etsy cache" });
        continue;
      }
      const pfPrice = r.retail_cents ?? 0;
      const etsyPrice = e.price_cents ?? 0;
      const delta = Math.abs(pfPrice - etsyPrice);
      if (delta > 50) {
        buckets.price_drift.push({
          listing_id: e.listing_id, title: r.title,
          pf_price: pfPrice / 100, etsy_price: etsyPrice / 100, delta: delta / 100,
        });
        drift_dollars += delta / 100;
      } else {
        buckets.synced.push({ listing_id: e.listing_id });
      }

      // lead direction
      const pfDate = r.pf_updated_at ? new Date(r.pf_updated_at).getTime() : 0;
      const etDate = e.etsy_updated_ts ? new Date(e.etsy_updated_ts).getTime() : 0;
      if (pfDate > etDate) pf_newer_than_etsy++;
      else if (etDate > pfDate) etsy_newer_than_pf++;
    }

    // ---- 5. Etsy orphans (in Etsy, not linked to any Printify product) ----
    const pfLinkedIds = new Set(rows.filter(r => r.etsy_listing_id).map(r => Number(r.etsy_listing_id)));
    for (const e of etsy ?? []) {
      if (!pfLinkedIds.has(Number((e as any).listing_id))) {
        buckets.orphan_etsy.push({ listing_id: (e as any).listing_id, title: (e as any).title });
      }
    }

    // ---- 6. Verdict ----
    const total = rows.length;
    const printifyLeadsScore =
      (rows.filter(r => r.published_to_etsy).length / Math.max(total, 1)) * 0.5 +
      (pf_newer_than_etsy / Math.max(pf_newer_than_etsy + etsy_newer_than_pf, 1)) * 0.5;
    const verdict =
      printifyLeadsScore > 0.6 ? "PRINTIFY_LEADS" :
      printifyLeadsScore < 0.4 ? "ETSY_LEADS" : "MIXED";

    const totals = {
      printify_products: total,
      etsy_active_listings: etsy?.length ?? 0,
      synced: buckets.synced.length,
      price_drift: buckets.price_drift.length,
      orphan_printify: buckets.orphan_printify.length,
      orphan_etsy: buckets.orphan_etsy.length,
      margin_thin: buckets.margin_thin.length,
      pf_newer_than_etsy,
      etsy_newer_than_pf,
      verdict,
      verdict_score: +printifyLeadsScore.toFixed(3),
    };

    // ---- 7. Record run ----
    const { data: run } = await sb.from("gng_audit_runs").insert({
      totals,
      drift_dollars,
      notes: `Verdict ${verdict} (score ${printifyLeadsScore.toFixed(2)})`,
    }).select("id, ran_at").maybeSingle();

    return new Response(JSON.stringify({
      success: true,
      run_id: run?.id,
      ran_at: run?.ran_at,
      totals,
      drift_dollars: +drift_dollars.toFixed(2),
      buckets: {
        // cap detail lists so response stays small
        price_drift: buckets.price_drift.slice(0, 50),
        orphan_printify: buckets.orphan_printify.slice(0, 50),
        orphan_etsy: buckets.orphan_etsy.slice(0, 50),
        margin_thin: buckets.margin_thin.slice(0, 50),
      },
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("gng-supply-chain-audit error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
