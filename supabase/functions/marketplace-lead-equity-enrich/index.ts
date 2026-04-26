// Enriches mortgage_radar_leads with equity range, year built, last sale data.
// Sources: BSEED ArcGIS (services2.arcgis.com/qvkbeam7Wirps6zC) + Detroit ArcGIS parcel layer.
// NO Zillow (dead since 2021). NO Wayne County ArcGIS (blocks server-side).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { logEnrichment } from "../_shared/enrichment-audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DETROIT_PARCELS = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/parcels/FeatureServer/0/query";
const BSEED_PERMITS = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_trades_permits/FeatureServer/0/query";

interface EquityResult {
  equity_range_low_cents: number | null;
  equity_range_high_cents: number | null;
  year_built: number | null;
  last_sale_price_cents: number | null;
  last_sale_date: string | null;
  source_url: string;
}

async function detroitParcelLookup(address: string): Promise<EquityResult | null> {
  if (!address) return null;
  try {
    const where = `address LIKE '%${address.toUpperCase().replace(/'/g, "''").slice(0, 60)}%'`;
    const url = `${DETROIT_PARCELS}?where=${encodeURIComponent(where)}&outFields=*&f=json&resultRecordCount=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const f = data?.features?.[0]?.attributes;
    if (!f) return null;

    const saleVal = Number(f.SALE_PRICE || f.sale_price || 0);
    const taxVal = Number(f.TAXABLE_VALUE || f.taxable_value || 0) * 2; // SEV ≈ 50% of market
    const marketEst = saleVal > 5000 ? saleVal : taxVal;

    return {
      equity_range_low_cents: marketEst > 0 ? Math.round(marketEst * 100 * 0.55) : null, // assume 55-75% equity for high-equity targets
      equity_range_high_cents: marketEst > 0 ? Math.round(marketEst * 100 * 0.75) : null,
      year_built: Number(f.YEAR_BUILT || f.year_built) || null,
      last_sale_price_cents: saleVal > 0 ? Math.round(saleVal * 100) : null,
      last_sale_date: f.SALE_DATE || f.sale_date || null,
      source_url: `https://detroitmi.gov/webapp/parcel-viewer?pid=${f.PARCELNO || ""}`,
    };
  } catch (e) {
    console.warn("[detroit]", e instanceof Error ? e.message : String(e));
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let body: { lead_id?: string; limit?: number } = {};
  try { body = await req.json(); } catch { /* default */ }

  const q = (sb.from as any)("mortgage_radar_leads")
    .select("id, address, city, year_built, equity_range_low_cents")
    .is("equity_range_low_cents", null)
    .order("score", { ascending: false });

  if (body.lead_id) q.eq("id", body.lead_id);
  else q.limit(Math.min(Math.max(body.limit ?? 25, 1), 50));

  const { data: leads, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const trace: any[] = [];
  let enriched = 0;

  for (const lead of leads || []) {
    if (!lead.address) { trace.push({ id: lead.id, skipped: "no address" }); continue; }
    const audited = await logEnrichment<EquityResult>(
      {
        lead_id: lead.id,
        vertical: "mortgage",
        function_name: "marketplace-lead-equity-enrich",
        stage: "equity",
        provider: "detroit_arcgis",
        triggered_by: body.lead_id ? "on_demand" : "cron",
      },
      async () => {
        const r = await detroitParcelLookup(lead.address!);
        if (!r) throw new Error("detroit_parcel_miss");
        return { data: r, fields_added: ["equity_range_low_cents", "year_built", "last_sale_price_cents"] };
      },
    );
    const result = audited.ok ? audited.data : null;
    if (result) {
      const sources = [{ field: "equity", url: result.source_url, fetched_at: new Date().toISOString() }];
      await (sb.from as any)("mortgage_radar_leads").update({
        equity_range_low_cents: result.equity_range_low_cents,
        equity_range_high_cents: result.equity_range_high_cents,
        year_built: result.year_built,
        last_sale_price_cents: result.last_sale_price_cents,
        last_sale_date: result.last_sale_date,
        provenance_source_urls: sources,
      }).eq("id", lead.id);
      enriched++;
      trace.push({ id: lead.id, hit: "detroit_parcel" });
    } else {
      trace.push({ id: lead.id, hit: "miss" });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: leads?.length || 0, enriched, trace }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
