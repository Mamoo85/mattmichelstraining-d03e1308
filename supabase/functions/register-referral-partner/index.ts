import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, payout_handle } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 100) {
      return new Response(JSON.stringify({ error: "Valid name is required (2-100 chars)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email is required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payout_handle && (typeof payout_handle !== "string" || payout_handle.length > 100)) {
      return new Response(JSON.stringify({ error: "Invalid payout handle." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Generate a safe referral code server-side
    const code = name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8).toUpperCase() + "-M2B";

    const { error } = await adminClient.from("b2b_referral_partners").insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      referral_code: code,
      payout_handle: payout_handle?.trim() || null,
      // Server controls these values — no client override possible
      commission_type: "flat",
      commission_value: 50,
      status: "active",
      total_earned: 0,
    });

    if (error) {
      if (error.code === "23505") {
        return new Response(
          JSON.stringify({ error: "You're already registered! Check your email for your referral code." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, code }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
