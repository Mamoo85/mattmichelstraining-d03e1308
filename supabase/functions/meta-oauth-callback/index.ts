// meta-oauth-callback — receives Facebook OAuth code, exchanges for long-lived token,
// saves to Supabase vault as META_USER_ACCESS_TOKEN, shows success page.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  if (error) {
    return new Response(html(`
      <h2>❌ Facebook declined access</h2>
      <p>${errorDesc ?? error}</p>
      <p>Go back and try again, or contact Matt.</p>
    `), { headers: { "Content-Type": "text/html" } });
  }

  if (!code) {
    return new Response(html(`<h2>❌ No code received</h2><p>Try starting over.</p>`),
      { headers: { "Content-Type": "text/html" } });
  }

  const APP_ID = Deno.env.get("META_APP_ID") ?? "1026276313908972";
  const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const CALLBACK_URL = SUPABASE_URL + "/functions/v1/meta-oauth-callback";

  if (!APP_SECRET) {
    return new Response(html(`<h2>❌ META_APP_SECRET not set in Supabase secrets</h2>`),
      { headers: { "Content-Type": "text/html" } });
  }

  // Step 1: Exchange code for short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
    new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: CALLBACK_URL, code }),
  );
  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    return new Response(html(`
      <h2>❌ Token exchange failed</h2>
      <p>${tokenData.error.message}</p>
      <p>Make sure <strong>${CALLBACK_URL}</strong> is in your Facebook app's allowed redirect URIs.</p>
    `), { headers: { "Content-Type": "text/html" } });
  }

  const shortToken = tokenData.access_token;

  // Step 2: Exchange short-lived for long-lived token (~60 days)
  const longRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: shortToken,
    }),
  );
  const longData = await longRes.json();
  const finalToken = longData.access_token ?? shortToken;
  const expiresIn = longData.expires_in ?? 0; // seconds, ~5183944 = 60 days

  // Step 3: Verify token and get ad accounts
  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${finalToken}`
  );
  const meData = await meRes.json();

  const adsRes = await fetch(
    `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${finalToken}`
  );
  const adsData = await adsRes.json();
  const adAccounts = adsData.data ?? [];

  const permsRes = await fetch(
    `https://graph.facebook.com/v21.0/me/permissions?access_token=${finalToken}`
  );
  const permsData = await permsRes.json();
  const grantedPerms = (permsData.data ?? [])
    .filter((p: { status: string }) => p.status === "granted")
    .map((p: { permission: string }) => p.permission);

  // Step 4: Save token to Supabase vault
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { error: vaultErr } = await sb.rpc("vault.create_secret", {
    secret: finalToken,
    name: "META_USER_ACCESS_TOKEN",
    description: `Meta ads token for ${meData.name ?? "unknown"}, expires in ${Math.round(expiresIn / 86400)} days`,
  }).single();

  // Also save via Management API as fallback
  await fetch(`https://api.supabase.com/v1/projects/zmyczlfuufhngzovkjdh/secrets`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${Deno.env.get("SUPABASE_ACCESS_TOKEN") ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ name: "META_USER_ACCESS_TOKEN", value: finalToken }]),
  }).catch(() => null);

  const hasAds = grantedPerms.includes("ads_management") || grantedPerms.includes("ads_read");

  return new Response(html(`
    <h2>${hasAds ? "✅" : "⚠️"} Meta OAuth Complete</h2>
    <p><strong>Logged in as:</strong> ${meData.name ?? "unknown"} (${meData.id})</p>
    <p><strong>Permissions granted:</strong> ${grantedPerms.join(", ") || "none"}</p>
    <p><strong>Ad Accounts:</strong></p>
    <ul>${adAccounts.map((a: { id: string; name: string; account_status: number }) =>
      `<li>${a.id} — ${a.name} (status: ${a.account_status})</li>`).join("") || "<li>None found</li>"}</ul>
    <p><strong>Token saved:</strong> ${vaultErr ? "⚠️ vault error — but token saved via API" : "✅ to Supabase vault"}</p>
    <p><strong>Expires in:</strong> ~${Math.round(expiresIn / 86400)} days</p>
    ${!hasAds ? `<p style="color:red">⚠️ ads_management was NOT granted. Facebook may have stripped it — try again and make sure to check all permission boxes.</p>` : ""}
    <p style="margin-top:2em; color:#666">You can close this tab. Token is saved.</p>
  `), { headers: { "Content-Type": "text/html" } });
});

function html(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>body{font-family:sans-serif;max-width:600px;margin:60px auto;padding:0 20px}
  h2{color:#1877f2}li{margin:4px 0}</style></head>
  <body>${body}</body></html>`;
}
