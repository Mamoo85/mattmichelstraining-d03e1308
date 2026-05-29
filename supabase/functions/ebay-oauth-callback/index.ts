/**
 * ebay-oauth-callback
 * Receives the auth code from eBay, exchanges it for tokens, stores in DB.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID   = Deno.env.get("EBAY_APP_ID")!;
const CERT_ID  = Deno.env.get("EBAY_CERT_ID")!;
const RU_NAME  = "Matthew_Michels-MatthewM-Gngsto-lxningvnx";

const CALLBACK_URL =
  "https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ebay-oauth-callback";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // User declined
  if (url.searchParams.get("declined") === "true") {
    return new Response("eBay auth declined.", { status: 200 });
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return new Response("Missing auth code from eBay.", { status: 400 });
  }

  // Exchange code for tokens
  const credentials = btoa(`${APP_ID}:${CERT_ID}`);
  const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: RU_NAME,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("eBay token exchange failed:", err);
    return new Response(`Token exchange failed: ${err}`, { status: 500 });
  }

  const data = await tokenRes.json();
  const {
    access_token,
    refresh_token,
    token_type,
    expires_in,
    refresh_token_expires_in,
  } = data;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expires_in * 1000);
  const refreshExpiresAt = new Date(
    now.getTime() + (refresh_token_expires_in ?? 47304000) * 1000
  );

  // Store in DB
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase.from("ebay_oauth_tokens").upsert(
    {
      account_id:          "gngstore",
      access_token,
      refresh_token,
      token_type,
      expires_at:          expiresAt.toISOString(),
      refresh_expires_at:  refreshExpiresAt.toISOString(),
      updated_at:          now.toISOString(),
    },
    { onConflict: "account_id" }
  );

  if (error) {
    console.error("DB upsert failed:", error);
    return new Response("Token stored but DB write failed: " + error.message, {
      status: 500,
    });
  }

  return new Response(
    `<html><body style="font-family:sans-serif;padding:40px">
      <h2>✅ eBay connected!</h2>
      <p>Access token stored. The auction cron is now authorized to create listings on your behalf.</p>
      <p>Token expires: ${expiresAt.toLocaleString()}</p>
      <p>You can close this tab.</p>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
});
