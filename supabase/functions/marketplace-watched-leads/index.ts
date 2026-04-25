import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
      .select("lead_id, product, last_price_cents")
      .eq("buyer_email", buyer_email.toLowerCase().trim())
      .order("created_at", { ascending: false })
      .limit(12);

    if (!watches || watches.length === 0) {
      return new Response(JSON.stringify({ leads: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = watches.map((w) => w.lead_id);

    // Query the unified view which covers mortgage, talent, demand, growth, supply
    const { data: leads } = await supabase
      .from("unified_lead_marketplace_view")
      .select("id, product, human_summary, city, zip, score")
      .in("id", ids);

    // Get current prices from locks table (works for all product types)
    const { data: locks } = await supabase
      .from("marketplace_lead_locks")
      .select("lead_id, price_cents")
      .in("lead_id", ids)
      .in("status", ["sold", "soft_locked"]);

    const byId = new Map((leads || []).map((l: any) => [l.id, l]));
    const lockByLeadId = new Map((locks || []).map((lk: any) => [lk.lead_id, lk.price_cents]));

    const merged = watches.map((w) => {
      const l: any = byId.get(w.lead_id) || {};
      return {
        lead_id: w.lead_id,
        product: w.product || l.product,
        last_price_cents: w.last_price_cents,
        current_price_cents: lockByLeadId.get(w.lead_id) ?? w.last_price_cents,
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
