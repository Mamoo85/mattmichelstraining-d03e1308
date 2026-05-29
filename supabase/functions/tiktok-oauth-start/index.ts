// tiktok-oauth-start — redirect Matt to TikTok authorization page
// Visit: https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/tiktok-oauth-start
// Requires: TIKTOK_CLIENT_KEY in Supabase Vault

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SCOPES = [
  "video.publish",    // post videos
  "video.upload",     // upload video files
  "user.info.basic",  // read profile info
].join(",");

const CALLBACK_URL = "https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/tiktok-oauth-callback";

serve(async (_req) => {
  const CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";

  if (!CLIENT_KEY) {
    return new Response("Missing TIKTOK_CLIENT_KEY — add it in Supabase Vault", { status: 500 });
  }

  // CSRF state token (simple timestamp-based)
  const state = `tiktok_${Date.now()}`;

  const params = new URLSearchParams({
    client_key: CLIENT_KEY,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: CALLBACK_URL,
    state,
  });

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

  console.log("[TIKTOK-OAUTH] Redirecting to TikTok authorization", { authUrl });

  return Response.redirect(authUrl, 302);
});
