// TOKEN-2 fix: PIN → server-issued tech session token.
// Replaces direct anon-key DB calls from FieldServiceTechApp.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const pin = String(body?.pin || "").trim();

    // Input validation — PIN must be 4 digits
    if (!/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "invalid_pin_format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify PIN via existing SECURITY DEFINER RPC
    const { data: tech, error: rpcErr } = await sb
      .rpc("verify_tech_pin", { _pin: pin })
      .maybeSingle();

    if (rpcErr) {
      console.error("[tech-session-create] verify_tech_pin RPC failed:", rpcErr);
      return new Response(JSON.stringify({ error: "verification_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tech) {
      return new Response(JSON.stringify({ error: "invalid_pin" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mint session token (12h expiry — matches typical work-shift length)
    const token = generateToken();
    const { error: insertErr } = await sb
      .from("tech_sessions")
      .insert({
        token,
        tech_id: tech.id,
        client_id: tech.client_id,
        tech_name: tech.name,
      });

    if (insertErr) {
      console.error("[tech-session-create] session insert failed:", insertErr);
      return new Response(JSON.stringify({ error: "session_create_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort cleanup of expired sessions
    sb.from("tech_sessions").delete().lt("expires_at", new Date().toISOString())
      .then(() => {}, () => {});

    return new Response(JSON.stringify({
      token,
      tech: { id: tech.id, name: tech.name, client_id: tech.client_id },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[tech-session-create] fatal:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
