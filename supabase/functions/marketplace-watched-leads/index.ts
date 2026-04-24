import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const { buyer_email } = await req.json();
    if (!buyer_email) {
      return new Response(JSON.stringify({ leads: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: watches } = await supabase
      .from("marketplace_buyer_watches")
      .select("lead_id, product, last_price_cents, created_at")
      .eq("buyer_email", buyer_email.toLowerCase().trim())
      .order("created_at", { ascending: false })
      .limit(12);

    if (!watches || watches.length === 0) {
      return new Response(JSON.stringify({ leads: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = (watches as any[]).map((w) => w.lead_id);
    // Pull from the unified view — works across all products (mortgage/talent/demand/growth/supply).
    const { data: leads } = await supabase
      .from("unified_lead_marketplace_view")
      .select("id, product, human_summary, city, zip, score, created_at")
      .in("id", ids);

    const byId = new Map(((leads || []) as any[]).map((l) => [l.id, l]));
    const merged = (watches as any[]).map((w) => {
      const l: any = byId.get(w.lead_id) || {};
      const ageDays = l.created_at
        ? (Date.now() - new Date(l.created_at).getTime()) / 86_400_000
        : 0;
      const currentPrice =
        l.score !== undefined ? priceForLead(l.score || 0, ageDays) : (w.last_price_cents ?? null);
      return {
        lead_id: w.lead_id,
        product: w.product || l.product,
        last_price_cents: w.last_price_cents,
        current_price_cents: currentPrice,
        human_summary: l.human_summary ?? null,
        city: l.city ?? null,
        zip: l.zip ?? null,
        score: l.score ?? null,
      };
    });

    return new Response(JSON.stringify({ leads: merged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ leads: [], error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
