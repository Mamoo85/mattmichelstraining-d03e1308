// youtube-oauth-callback — exchanges code for tokens, stores in youtube_oauth_tokens
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const CLIENT_ID = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
  const CLIENT_SECRET = Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "";
  const REDIRECT_URI = Deno.env.get("YOUTUBE_REDIRECT_URI") ??
    "https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/youtube-oauth-callback";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`<h2>OAuth denied: ${error}</h2>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code) {
    return new Response("<h2>Missing code parameter</h2>", {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return new Response(`<h2>Token exchange failed: ${err.slice(0, 200)}</h2>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Fetch channel info to get channel_id
  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const channelData = await channelRes.json();
  const channelId = channelData?.items?.[0]?.id ?? "";
  const channelTitle = channelData?.items?.[0]?.snippet?.title ?? "";

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Upsert token row
  const { error: dbErr } = await sb.from("youtube_oauth_tokens").upsert({
    channel_id: channelId,
    channel_title: channelTitle,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    scope: tokens.scope,
    updated_at: new Date().toISOString(),
  }, { onConflict: "channel_id" });

  if (dbErr) {
    return new Response(`<h2>DB error: ${dbErr.message}</h2>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response(
    `<h2>✅ YouTube authorized!</h2><p>Channel: <strong>${channelTitle}</strong> (${channelId})</p><p>You can close this tab. YouTube Shorts will start uploading daily at 3pm UTC.</p>`,
    { headers: { "Content-Type": "text/html" } }
  );
});
