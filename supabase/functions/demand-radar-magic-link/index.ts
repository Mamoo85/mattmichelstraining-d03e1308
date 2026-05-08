// GET /demand-radar-magic-link?email=foo@bar.com
// Mints a fresh 7-day HMAC dashboard token for Demand Radar and 302-redirects
// to /my-demand-radar?email=...&token=...
//
// Used by the AmeriSteel (and future) bundle hub pages so we don't have to
// hardcode a signed token that will expire.
//
// verify_jwt = false (public endpoint)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode } from "https://deno.land/std@0.190.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HMAC_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_BASE = Deno.env.get("APP_BASE_URL") || "https://detroitwebagent.com";

async function signDashboardToken(email: string): Promise<string> {
  const payload = JSON.stringify({ email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const tokenB64 = encode(new TextEncoder().encode(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(tokenB64));
  return `${tokenB64}.${encode(new Uint8Array(sig))}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email")?.trim().toLowerCase();
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return new Response("Missing or invalid email", { status: 400, headers: corsHeaders });
    }

    const token = await signDashboardToken(email);
    const dest = `${APP_BASE}/my-demand-radar?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: dest },
    });
  } catch (e) {
    console.error("[demand-radar-magic-link]", e);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});
