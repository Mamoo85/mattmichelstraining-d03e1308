import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateCode(email: string): string {
  const slug = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase().substring(0, 6);
  const rand = Math.random().toString(16).substring(2, 6);
  return `${slug}${rand}`.toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Try to find existing partner
    const { data: existing } = await sb
      .from("b2b_partners")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({
          code: existing.referral_code,
          referral_link: `https://www.mattmichelstraining.com/get-started?ref=${existing.referral_code}`,
          active_referrals: existing.total_referrals,
          pending_payout: existing.pending_payout,
          total_paid: existing.total_paid,
          is_new: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new partner — generate unique code
    let code = generateCode(email);

    // Retry once if code collision (extremely rare)
    const { data: collision } = await sb.from("b2b_partners").select("id").eq("referral_code", code).single();
    if (collision) {
      code = generateCode(email + Date.now());
    }

    const { data: newPartner, error: insertErr } = await sb
      .from("b2b_partners")
      .insert({
        email: email.toLowerCase().trim(),
        referral_code: code,
        active: true,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        code: newPartner.referral_code,
        referral_link: `https://www.mattmichelstraining.com/get-started?ref=${newPartner.referral_code}`,
        active_referrals: 0,
        pending_payout: 0,
        total_paid: 0,
        is_new: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET-PARTNER-STATS] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
