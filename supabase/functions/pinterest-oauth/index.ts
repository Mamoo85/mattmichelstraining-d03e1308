// pinterest-oauth — OAuth 2.0 PKCE flow for Pinterest API
// Handles both the auth start (redirecting user to Pinterest) and the callback (exchanging code for tokens).
//
// SETUP REQUIRED (one-time):
//   1. Go to developers.pinterest.com → your app (ID: 1570813) → Edit → Redirect URIs
//   2. Add: https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pinterest-oauth
//   3. Set secrets in secondary project:
//      PINTEREST_CLIENT_ID = 1570813
//      PINTEREST_CLIENT_SECRET = (from your app settings page)
//
// FLOWS:
//   GET ?action=start&redirect_after=<url>
//     → Redirects browser to Pinterest OAuth authorization page
//   GET ?action=callback&code=<code>&state=<state>
//     → Exchanges code for tokens, stores in pinterest_oauth_tokens, redirects to redirect_after
//
// USAGE FROM FRONTEND:
//   window.location.href = `${SECONDARY_URL}/functions/v1/pinterest-oauth?action=start&redirect_after=${encodeURIComponent(window.location.href)}`

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID     = Deno.env.get("PINTEREST_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("PINTEREST_CLIENT_SECRET") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// The callback URL must match exactly what's registered in Pinterest app settings
const CALLBACK_URL  = `${SUPABASE_URL}/functions/v1/pinterest-oauth`;

// Pinterest API v5 OAuth endpoints
const PINTEREST_AUTH_URL  = "https://www.pinterest.com/oauth/";
const PINTEREST_TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";

// Scopes needed for our use case: read boards, write pins, read+write pin metadata
const SCOPES = [
  "boards:read",
  "boards:write",
  "pins:read",
  "pins:write",
  "user_accounts:read",
].join(",");

const log = (step: string, data?: unknown) =>
  console.log(`[PINTEREST-OAUTH] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

function html(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><title>${title}</title>
    <meta charset="utf-8">
    <style>body{font-family:system-ui;max-width:600px;margin:60px auto;padding:20px;text-align:center;}
    .card{background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.1);}
    h2{color:#e60023;margin-bottom:8px;} p{color:#555;} .success{color:#16a34a;} .error{color:#dc2626;}</style>
    </head><body><div class="card">${body}</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "callback";

  // ── Config check ─────────────────────────────────────────────────────────────
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return html("Pinterest OAuth — Not Configured", `
      <h2>⚙️ Setup Required</h2>
      <p>Add these secrets to the secondary Supabase project:</p>
      <ul style="text-align:left;margin-top:16px">
        <li><strong>PINTEREST_CLIENT_ID</strong> — your app client ID (e.g. 1570813)</li>
        <li><strong>PINTEREST_CLIENT_SECRET</strong> — from developers.pinterest.com → your app → settings</li>
      </ul>
      <p style="margin-top:16px">Also register this redirect URI in your Pinterest app:<br>
      <code>${CALLBACK_URL}</code></p>
    `);
  }

  // ── Start: generate auth URL + redirect ──────────────────────────────────────
  if (action === "start") {
    const redirectAfter = url.searchParams.get("redirect_after")
      ?? "https://detroitwebagent.com/dwa-admin/shorts?oauth=success&platform=pinterest";

    // Generate a random state to prevent CSRF
    const state = crypto.randomUUID();

    // Store state + redirect_after in DB so callback can retrieve it
    if (SUPABASE_URL && SERVICE_KEY) {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
      await sb.from("pinterest_oauth_state").upsert({
        state,
        redirect_after: redirectAfter,
        created_at: new Date().toISOString(),
      }).then(() => {});
    }

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: CALLBACK_URL,
      response_type: "code",
      scope: SCOPES,
      state,
    });

    const authUrl = `${PINTEREST_AUTH_URL}?${params}`;
    log("Redirecting to Pinterest OAuth", { authUrl: authUrl.slice(0, 100) });

    return Response.redirect(authUrl, 302);
  }

  // ── Callback: exchange code for tokens ────────────────────────────────────────
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    log("Pinterest denied access", { error });
    return html("Pinterest Authorization Denied", `
      <h2 class="error">❌ Authorization Denied</h2>
      <p>Pinterest returned: <strong>${error}</strong></p>
      <p>You can close this window and try again from the admin panel.</p>
    `);
  }

  if (!code || !state) {
    return html("Pinterest OAuth — Missing Parameters", `
      <h2 class="error">Missing Parameters</h2>
      <p>Expected <code>code</code> and <code>state</code> in callback URL.</p>
    `);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Look up state to get redirect_after
  const { data: stateRow } = await sb
    .from("pinterest_oauth_state")
    .select("redirect_after, created_at")
    .eq("state", state)
    .single();

  const redirectAfter = stateRow?.redirect_after
    ?? "https://detroitwebagent.com/dwa-admin/shorts?oauth=success&platform=pinterest";

  // Clean up used state
  await sb.from("pinterest_oauth_state").delete().eq("state", state).then(() => {});

  // Exchange authorization code for access + refresh tokens
  log("Exchanging code for tokens");
  let tokenData: Record<string, unknown>;
  try {
    const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const tokenRes = await fetch(PINTEREST_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: CALLBACK_URL,
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    });

    tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(`Pinterest token exchange failed: ${JSON.stringify(tokenData).slice(0, 300)}`);
    }
  } catch (err) {
    log("Token exchange error", { error: String(err) });
    return html("Pinterest OAuth — Token Exchange Failed", `
      <h2 class="error">❌ Token Exchange Failed</h2>
      <p>${String(err).slice(0, 200)}</p>
      <p>Check that PINTEREST_CLIENT_SECRET is correct and that the redirect URI is registered.</p>
    `);
  }

  const accessToken  = String(tokenData.access_token ?? "");
  const refreshToken = String(tokenData.refresh_token ?? "");
  const expiresIn    = Number(tokenData.expires_in ?? 2592000); // default 30 days
  const scope        = String(tokenData.scope ?? "");
  const tokenType    = String(tokenData.token_type ?? "bearer");

  // Fetch the Pinterest user's profile to get their user_id + username
  let pinterestUserId = "";
  let pinterestUsername = "";
  try {
    const profileRes = await fetch("https://api.pinterest.com/v5/user_account", {
      headers: { "Authorization": `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const profile = await profileRes.json();
    pinterestUserId   = String(profile.id ?? "");
    pinterestUsername = String(profile.username ?? "");
    log("Pinterest user fetched", { pinterestUserId, pinterestUsername });
  } catch (err) {
    log("Could not fetch Pinterest profile", { error: String(err) });
  }

  // Upsert tokens into DB
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const { error: dbError } = await sb.from("pinterest_oauth_tokens").upsert({
    user_label: "matt", // default label; multi-user support: pass user_id in state
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    scope,
    expires_at: expiresAt,
    pinterest_user_id: pinterestUserId,
    pinterest_username: pinterestUsername,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_label" });

  if (dbError) {
    log("DB upsert error", { error: dbError.message });
    return html("Pinterest OAuth — Database Error", `
      <h2 class="error">❌ Database Error</h2>
      <p>${dbError.message}</p>
    `);
  }

  log("Tokens stored", { pinterestUsername, expiresAt });

  // Redirect back to the admin panel with success
  return Response.redirect(
    `${redirectAfter}${redirectAfter.includes("?") ? "&" : "?"}pinterest_connected=true&username=${encodeURIComponent(pinterestUsername)}`,
    302
  );
});
