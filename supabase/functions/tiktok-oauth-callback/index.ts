// tiktok-oauth-callback
// 1. TikTok domain verification file
// 2. OAuth code → token exchange → stored in tiktok_oauth_tokens

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const pathname = url.pathname;

  // Domain verification file
  if (pathname.includes("tiktokarrSMZ29aMpPcTOC66A7pi3gTciqxj31")) {
    return new Response(
      "tiktok-developers-site-verification=arrSMZ29aMpPcTOC66A7pi3gTciqxj31",
      { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400", ...corsHeaders } }
    );
  }

  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return new Response(`<html><body><h2>TikTok Auth Error</h2><p>${errorParam}</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html", ...corsHeaders } });
  }

  if (!code) {
    return new Response(JSON.stringify({ status: "ok", message: "TikTok OAuth callback endpoint is live." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const CLIENT_KEY    = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";
  const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "";
  const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const REDIRECT_URI  = `${SUPABASE_URL}/functions/v1/tiktok-oauth-callback`;

  if (!CLIENT_KEY || !CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: REDIRECT_URI }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return new Response(`<html><body><h2>Token exchange failed</h2><pre>${err.slice(0,500)}</pre></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html", ...corsHeaders } });
  }

  const { access_token, refresh_token, expires_in, open_id, scope } = await tokenRes.json();
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  let displayName = open_id;
  try {
    const userRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name",
      { headers: { Authorization: `Bearer ${access_token}` } });
    if (userRes.ok) {
      const ud = await userRes.json();
      displayName = ud?.data?.user?.display_name ?? open_id;
    }
  } catch { /* non-fatal */ }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  await sb.from("tiktok_oauth_tokens").upsert(
    { open_id, access_token, refresh_token, expires_at: expiresAt, display_name: displayName, updated_at: new Date().toISOString() },
    { onConflict: "open_id" }
  );

  console.log(`[TIKTOK-OAUTH] Stored tokens for ${displayName} (${open_id})`);

  return new Response(
    `<html><body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center;"><h2>✅ TikTok Connected!</h2><p>Account: <strong>${displayName}</strong></p><p>Scope: ${scope}</p><p>Tokens saved. You can close this tab.</p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html", ...corsHeaders } }
  );
});
