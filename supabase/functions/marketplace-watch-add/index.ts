import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Pricing tiers — must match marketplace pricing logic in watch-price-drop & checkout
function priceForLead(score: number, ageDays: number): number {
  if (ageDays > 14) return 1500;
  if (ageDays > 7) return 3500;
  if (score >= 8) return 9900;
  if (score >= 6) return 6900;
  return 4900;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { buyer_email, lead_id, product, action } = await req.json();
    if (!buyer_email || !lead_id) {
      return new Response(JSON.stringify({ ok: false, error: "missing buyer_email or lead_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const email = String(buyer_email).toLowerCase().trim();

    if (action === "remove") {
      await supabase
        .from("marketplace_buyer_watches")
        .delete()
        .eq("buyer_email", email)
        .eq("lead_id", lead_id);
      return new Response(JSON.stringify({ ok: true, removed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Snapshot current computed price for price-drop tracking.
    // Source table varies by product; we use the unified view which is product-agnostic.
    let snapshotPrice: number | null = null;
    let resolvedProduct = product || "mortgage";
    try {
      const { data: lead } = await supabase
        .from("unified_lead_marketplace_view")
        .select("score, created_at, product")
        .eq("id", lead_id)
        .maybeSingle();
      if (lead) {
        const ageDays = (Date.now() - new Date(lead.created_at as string).getTime()) / 86_400_000;
        snapshotPrice = priceForLead((lead.score as number) || 0, ageDays);
        resolvedProduct = (lead.product as string) || resolvedProduct;
      }
    } catch (_e) {
      // non-fatal — watch row will just have null snapshot
    }

    await supabase.from("marketplace_buyer_watches").upsert(
      {
        buyer_email: email,
        lead_id,
        product: resolvedProduct,
        last_price_cents: snapshotPrice,
      },
      { onConflict: "buyer_email,lead_id" }
    );

    return new Response(JSON.stringify({ ok: true, snapshot_price_cents: snapshotPrice }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
