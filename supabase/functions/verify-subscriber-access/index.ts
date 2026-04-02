import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, niche } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Check b2b_subscribers for active subscription
    let query = sb
      .from("b2b_subscribers")
      .select("id, email, niche, active")
      .eq("email", email.toLowerCase().trim())
      .eq("active", true);

    if (niche) {
      query = query.eq("niche", niche);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      console.error("[verify-subscriber-access]", error);
      return new Response(JSON.stringify({ error: "Verification failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ verified: false, message: "No active subscription found for this email." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a simple time-limited token (24hr expiry)
    const token = btoa(JSON.stringify({
      email: data.email,
      niche: data.niche,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    }));

    return new Response(JSON.stringify({ verified: true, token, niche: data.niche }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[verify-subscriber-access]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
