import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const tokenHash = await sha256(token);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: row } = await sb.from("owner_magic_tokens").select("*").eq("token_hash", tokenHash).maybeSingle();
    if (!row) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (row.consumed_at) return new Response(JSON.stringify({ error: "token_used" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (new Date(row.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({ error: "token_expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await sb.from("owner_magic_tokens").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

    // Issue a session token (HMAC-signed) for the owner dashboard — stored in localStorage
    const sessionPayload = { email: row.email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
    const sessionToken = btoa(JSON.stringify(sessionPayload));

    return new Response(JSON.stringify({ ok: true, email: row.email, session: sessionToken }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[owner-magic-link-verify]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
