// etsy-oauth-callback — exchanges OAuth code for tokens, fetches shop ID, stores everything
// GET /functions/v1/etsy-oauth-callback?code=...&state=...
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ETSY_KEY     = Deno.env.get("ETSY_API_KEY") || "";
const CALLBACK_URL = `https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-oauth-callback`;

Deno.serve(async (req) => {
  const url    = new URL(req.url);
  const code   = url.searchParams.get("code");
  const state  = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  if (errParam) {
    return html(`<h2 style="color:red">Etsy denied access: ${errParam}</h2>`);
  }
  if (!code || !state) {
    return html(`<h2 style="color:red">Missing code or state parameter.</h2>`);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Look up PKCE verifier
  const { data: pkce } = await sb.from("etsy_oauth_pkce")
    .select("code_verifier").eq("state", state).single();

  if (!pkce?.code_verifier) {
    return html(`<h2 style="color:red">State not found or expired. Please start over.</h2>`);
  }

  // Delete used state
  await sb.from("etsy_oauth_pkce").delete().eq("state", state);

  // Exchange code for tokens
  const tokenRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     ETSY_KEY,
      redirect_uri:  CALLBACK_URL,
      code,
      code_verifier: pkce.code_verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    return html(`<h2 style="color:red">Token exchange failed: ${JSON.stringify(tokenData)}</h2>`);
  }

  const { access_token, refresh_token, expires_in, token_type } = tokenData;
  const expires_at = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

  // Fetch user ID
  let user_id = "";
  let shop_id = "";
  try {
    const meRes = await fetch("https://openapi.etsy.com/v3/application/users/me", {
      headers: { "x-api-key": ETSY_KEY, Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const me = await meRes.json();
    user_id = String(me.user_id ?? "");

    // Fetch shop
    if (user_id) {
      const shopRes = await fetch(`https://openapi.etsy.com/v3/application/users/${user_id}/shops`, {
        headers: { "x-api-key": ETSY_KEY, Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(10_000),
      });
      const shopData = await shopRes.json();
      shop_id = String(shopData?.shop_id ?? shopData?.results?.[0]?.shop_id ?? "");
    }
  } catch { /* non-fatal */ }

  // Store tokens in DB
  await sb.from("etsy_oauth_tokens").insert({
    access_token, refresh_token, token_type,
    expires_at, shop_id, user_id,
  });

  return html(`
    <h2 style="color:#22c55e">✓ Etsy Connected Successfully!</h2>
    <p><strong>Shop ID:</strong> ${shop_id || "Not found — set manually"}</p>
    <p><strong>User ID:</strong> ${user_id}</p>
    <p><strong>Token expires:</strong> ${expires_at}</p>
    <p style="margin-top:20px;color:#64748b;">
      Tokens are stored in your Supabase <code>etsy_oauth_tokens</code> table.<br/>
      ${shop_id
        ? `Also add <strong>ETSY_SHOP_ID=${shop_id}</strong> to your Supabase Edge Function Secrets for extra reliability.`
        : `You'll need to set <strong>ETSY_SHOP_ID</strong> manually in Supabase Edge Function Secrets — find your shop ID at etsy.com/your/shops.`
      }
    </p>
    <p style="color:#22c55e;font-weight:bold;">The etsy-digital-uploader will now run autonomously. You can close this tab.</p>
  `);
});

function html(body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:20px;background:#0f172a;color:#e2e8f0;">${body}</body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
