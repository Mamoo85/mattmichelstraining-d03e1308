// OAuth callback for client Facebook/LinkedIn connections
// Exchanges auth code for token and saves to social_media_clients.access_tokens
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID") || "";
const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET") || "";
const META_APP_ID = Deno.env.get("META_APP_ID") || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/social-oauth-callback`;

function html(title: string, message: string, success: boolean) {
  const color = success ? "#22c55e" : "#ef4444";
  const icon = success ? "✅" : "❌";
  return new Response(
    `<html><body style="font-family:system-ui,sans-serif;max-width:500px;margin:80px auto;text-align:center;">
      <h2 style="color:${color}">${icon} ${title}</h2>
      <p style="color:#475569;font-size:15px;">${message}</p>
      <p style="color:#94a3b8;font-size:13px;margin-top:24px;">You can close this window.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return html("Connection Failed", `OAuth error: ${error}`, false);
  }
  if (!code || !stateRaw) {
    return html("Connection Failed", "Missing authorization code or state.", false);
  }

  let state: { client_id: string; platform: string };
  try {
    state = JSON.parse(atob(stateRaw));
  } catch {
    return html("Connection Failed", "Invalid state parameter.", false);
  }

  const { client_id, platform } = state;
  if (!client_id || !platform) {
    return html("Connection Failed", "Missing client_id or platform in state.", false);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (platform === "linkedin") {
      // Exchange code for LinkedIn token
      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: CALLBACK_URL,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
        }).toString(),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        console.error("[SOCIAL-OAUTH] LinkedIn token exchange failed:", tokenData);
        return html("Connection Failed", "Could not get LinkedIn token. Please try again.", false);
      }

      // Get existing tokens, merge
      const { data: client } = await sb
        .from("social_media_clients")
        .select("access_tokens")
        .eq("id", client_id)
        .single();

      const tokens = (client?.access_tokens as Record<string, string>) || {};
      tokens.linkedin = tokenData.access_token;

      await sb
        .from("social_media_clients")
        .update({ access_tokens: tokens })
        .eq("id", client_id);

      return html("LinkedIn Connected!", "Your LinkedIn account is now linked. AI posts will start on your next posting day.", true);

    } else if (platform === "facebook") {
      // Exchange code for short-lived token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          redirect_uri: CALLBACK_URL,
          code,
        })}`
      );

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        console.error("[SOCIAL-OAUTH] Facebook token exchange failed:", tokenData);
        return html("Connection Failed", "Could not get Facebook token. Please try again.", false);
      }

      // Exchange for long-lived token
      const longRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          fb_exchange_token: tokenData.access_token,
        })}`
      );
      const longData = await longRes.json();
      const userToken = longData.access_token || tokenData.access_token;

      // Get pages the user manages
      const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`
      );
      const pagesData = await pagesRes.json();
      const pages = pagesData.data || [];

      if (pages.length === 0) {
        return html("No Pages Found", "Your Facebook account doesn't manage any Pages. You need a Facebook Business Page for posting.", false);
      }

      // Use the first page (most clients have one)
      const page = pages[0];
      const pageToken = page.access_token;
      const pageId = page.id;

      // Save to client record
      const { data: client } = await sb
        .from("social_media_clients")
        .select("access_tokens")
        .eq("id", client_id)
        .single();

      const tokens = (client?.access_tokens as Record<string, string>) || {};
      tokens.facebook = pageToken;

      await sb
        .from("social_media_clients")
        .update({ access_tokens: tokens, fb_page_id: pageId })
        .eq("id", client_id);

      return html("Facebook Connected!", `Connected to page "${page.name}". AI posts will start on your next posting day.`, true);

    } else {
      return html("Connection Failed", `Unknown platform: ${platform}`, false);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[SOCIAL-OAUTH] Error:", e);
    return html("Connection Failed", `Error: ${msg}`, false);
  }
});
