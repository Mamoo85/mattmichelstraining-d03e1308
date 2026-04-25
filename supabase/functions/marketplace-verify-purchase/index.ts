// marketplace-verify-purchase — server-side ownership check called by LeadDetail.tsx
// after a Stripe redirect, to confirm the webhook has marked the lock as sold.
// POST { lead_id, product, buyer_email } → { owned: boolean }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, product, buyer_email } = await req.json();
    const email = String(buyer_email || "").trim().toLowerCase();
    if (!lead_id || !email) {
      return new Response(JSON.stringify({ owned: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    let q = sb.from("marketplace_lead_locks")
      .select("status")
      .eq("lead_id", lead_id)
      .eq("buyer_email", email)
      .eq("status", "sold");
    if (product) q = q.eq("product", product);

    const { data } = await q.maybeSingle();

    return new Response(JSON.stringify({ owned: !!data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[marketplace-verify-purchase]", e);
    return new Response(JSON.stringify({ owned: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
