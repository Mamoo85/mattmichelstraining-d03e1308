import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID") || "";
const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET") || "";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/linkedin-auth-callback`;

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`<h2>LinkedIn Auth Error: ${error}</h2>`, {
      headers: { "Content-Type": "text/html" },
      status: 400,
    });
  }

  if (!code) {
    return new Response("<h2>No code received from LinkedIn.</h2>", {
      headers: { "Content-Type": "text/html" },
      status: 400,
    });
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("[LINKEDIN-AUTH] Token exchange failed:", tokenData);
      return new Response(`<h2>Token exchange failed: ${JSON.stringify(tokenData)}</h2>`, {
        headers: { "Content-Type": "text/html" },
        status: 500,
      });
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000);

    // Store token in oauth_tokens table
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await sb.from("oauth_tokens").upsert({
      provider: "linkedin",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: expiresAt.toISOString(),
      scope: tokenData.scope || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider" });

    return new Response(`
      <html><body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center;">
        <h2 style="color:#0a66c2;">✅ LinkedIn Connected!</h2>
        <p>Your LinkedIn account is now linked to M². Auto-posting is active.</p>
        <p style="color:#888;font-size:13px;">Token expires: ${expiresAt.toLocaleDateString()}</p>
        <p style="color:#888;font-size:13px;">You can close this window.</p>
      </body></html>
    `, { headers: { "Content-Type": "text/html" } });

  } catch (e: any) {
    console.error("[LINKEDIN-AUTH] Error:", e);
    return new Response(`<h2>Error: ${e.message}</h2>`, {
      headers: { "Content-Type": "text/html" },
      status: 500,
    });
  }
});
