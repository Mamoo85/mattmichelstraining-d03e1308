import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    // Snapshot current price from lead lock (works for all product types)
    const { data: lock } = await supabase
      .from("marketplace_lead_locks")
      .select("price_cents, product")
      .eq("lead_id", lead_id)
      .in("status", ["sold", "soft_locked"])
      .order("created_at", { ascending: false })
      .maybeSingle();

    await supabase.from("marketplace_buyer_watches").upsert(
      {
        buyer_email: email,
        lead_id,
        product: product || lock?.product || "mortgage",
        last_price_cents: lock?.price_cents ?? null,
      },
      { onConflict: "buyer_email,lead_id" }
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
