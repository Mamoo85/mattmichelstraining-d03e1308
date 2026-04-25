// POST { email, token } → { valid: boolean }
// Verifies HMAC-SHA256 signed dashboard tokens issued by mortgage-radar-digest.
// Tokens encode { email, exp } and expire after 7 days.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode, decode } from "https://deno.land/std@0.190.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HMAC_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, token } = await req.json();
    if (!email || !token || typeof token !== "string") {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);

    let provided: Uint8Array;
    try { provided = decode(sigB64); } catch {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = await getKey();
    const expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(tokenB64)),
    );

    // Constant-time comparison — prevents timing attacks
    if (expected.length !== provided.length) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
    if (diff !== 0) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: { email: string; exp: number };
    try {
      payload = JSON.parse(new TextDecoder().decode(decode(tokenB64)));
    } catch {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.email?.toLowerCase() !== String(email).toLowerCase().trim()) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payload.exp || payload.exp < Date.now()) {
      return new Response(JSON.stringify({ valid: false, reason: "expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ valid: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[verify-dashboard-token]", e);
    return new Response(JSON.stringify({ valid: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
