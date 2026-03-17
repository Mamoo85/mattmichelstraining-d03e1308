import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    const { code, action } = await req.json();
    if (!code) throw new Error("Gift card code required");

    // action: "check" just returns balance, "apply" with amount deducts
    const { data: card, error: cardError } = await supabaseClient
      .from("gift_cards")
      .select("*")
      .eq("code", code.toUpperCase().trim())
      .eq("is_active", true)
      .single();

    if (cardError || !card) {
      return new Response(JSON.stringify({ error: "Invalid or used gift card code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (card.remaining_balance <= 0) {
      return new Response(JSON.stringify({ error: "This gift card has no remaining balance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (action === "check") {
      return new Response(JSON.stringify({
        valid: true,
        remaining_balance: card.remaining_balance,
        original_amount: card.original_amount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For "apply" action — deduct amount
    const { amount } = await req.json().catch(() => ({ amount: 0 }));
    const deduction = Math.min(amount || card.remaining_balance, card.remaining_balance);
    const newBalance = card.remaining_balance - deduction;

    await supabaseClient
      .from("gift_cards")
      .update({
        remaining_balance: newBalance,
        is_active: newBalance > 0,
        redeemed_by: userData.user.id,
        redeemed_at: new Date().toISOString(),
      })
      .eq("id", card.id);

    return new Response(JSON.stringify({
      applied: deduction,
      remaining_balance: newBalance,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
