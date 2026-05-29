// youtube-oauth-start — redirects user to Google OAuth consent screen
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const CLIENT_ID = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
  const REDIRECT_URI = Deno.env.get("YOUTUBE_REDIRECT_URI") ??
    "https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/youtube-oauth-callback";

  if (!CLIENT_ID) {
    return new Response(JSON.stringify({ error: "YOUTUBE_CLIENT_ID not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return Response.redirect(authUrl, 302);
});
