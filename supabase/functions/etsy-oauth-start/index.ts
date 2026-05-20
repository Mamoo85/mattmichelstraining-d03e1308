// Begin Etsy OAuth2 PKCE handshake. Redirects user to Etsy's consent page.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("ETSY_API_KEY");
    if (!apiKey) throw new Error("ETSY_API_KEY missing");

    const url = new URL(req.url);
    const redirectBack = url.searchParams.get("redirect_back") ?? "";
    const projectRef = Deno.env.get("SUPABASE_URL")!.split("//")[1].split(".")[0];
    const redirectUri = `https://${projectRef}.functions.supabase.co/etsy-oauth-callback`;

    // PKCE
    const verifierBytes = crypto.getRandomValues(new Uint8Array(64));
    const codeVerifier = base64url(verifierBytes.buffer);
    const challengeBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
    const codeChallenge = base64url(challengeBuf);
    const state = base64url(crypto.getRandomValues(new Uint8Array(24)).buffer);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await sb.from("etsy_oauth_pending").insert({ state, code_verifier: codeVerifier, redirect_back: redirectBack });

    const scopes = [
      "shops_r", "shops_w",
      "listings_r", "listings_w",
      "transactions_r",
      "profile_r",
      "email_r",
    ].join(" ");

    const authUrl = new URL("https://www.etsy.com/oauth/connect");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", apiKey);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return Response.redirect(authUrl.toString(), 302);
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
