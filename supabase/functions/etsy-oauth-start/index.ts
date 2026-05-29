// etsy-oauth-start — generates PKCE challenge and redirects to Etsy authorization page
// GET /functions/v1/etsy-oauth-start  → redirects browser to Etsy OAuth
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ETSY_KEY     = Deno.env.get("ETSY_API_KEY") || "";

const CALLBACK_URL = `${SUPABASE_URL.replace("supabase.co", "supabase.co")}/functions/v1/etsy-oauth-callback`
  .replace("https://zmyczlfuufhngzovkjdh.supabase.co", "https://zmyczlfuufhngzovkjdh.supabase.co");

const SCOPES = "listings_r listings_w listings_d shops_r transactions_r";

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

Deno.serve(async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Generate PKCE code_verifier
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const code_verifier = base64url(verifierBytes.buffer);

  // Generate code_challenge = BASE64URL(SHA256(code_verifier))
  const encoded = new TextEncoder().encode(code_verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const code_challenge = base64url(digest);

  // Generate state
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = base64url(stateBytes.buffer);

  // Store in DB
  await sb.from("etsy_oauth_pkce").insert({ state, code_verifier });

  // Clean up old states (>1 hour)
  await sb.from("etsy_oauth_pkce")
    .delete()
    .lt("created_at", new Date(Date.now() - 3600_000).toISOString());

  const authUrl = new URL("https://www.etsy.com/oauth/connect");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", ETSY_KEY);
  authUrl.searchParams.set("redirect_uri", CALLBACK_URL);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", code_challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return Response.redirect(authUrl.toString(), 302);
});
