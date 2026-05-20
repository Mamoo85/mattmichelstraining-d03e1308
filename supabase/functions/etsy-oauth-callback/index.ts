// OAuth2 callback. Exchanges code for tokens, stores them, redirects to admin.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = { "Access-Control-Allow-Origin": "*" };
const DEFAULT_BACK_URL = "https://www.detroitwebagent.com/dwa-admin";

function html(body: string, status = 200) {
  return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Etsy Connect</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0a1628;color:#fff;padding:40px;text-align:center;line-height:1.5}a{color:#00d4ff}code,pre{white-space:pre-wrap;word-break:break-word}</style></head><body>${body}</body></html>`, {
    status,
    headers: { ...corsHeaders, "content-type": "text/html; charset=utf-8" },
  });
}

function safeBackUrl(raw: unknown) {
  const value = typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_BACK_URL;
  if (value.startsWith("/")) return new URL(value, DEFAULT_BACK_URL).toString();
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : DEFAULT_BACK_URL;
  } catch {
    return DEFAULT_BACK_URL;
  }
}

function redirectBack(raw: unknown, params: Record<string, string>) {
  const back = new URL(safeBackUrl(raw));
  for (const [key, value] of Object.entries(params)) back.searchParams.set(key, value);
  return Response.redirect(back.toString(), 303);
}

function extractShop(payload: any) {
  return payload?.shop_id ? payload : (payload?.results?.[0] ?? (Array.isArray(payload) ? payload[0] : null));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");
    if (err) return redirectBack(null, { etsy: "declined", error: err });
    if (!code || !state) return redirectBack(null, { etsy: "error", error: "missing_code_or_state" });

    const apiKey = Deno.env.get("ETSY_API_KEY");
    const sharedSecret = Deno.env.get("ETSY_SHARED_SECRET") ?? "";
    if (!apiKey) throw new Error("ETSY_API_KEY missing");
    const apiKeyCombined = sharedSecret ? `${apiKey}:${sharedSecret}` : apiKey;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: pending } = await sb.from("etsy_oauth_pending").select("*").eq("state", state).maybeSingle();
    if (!pending) return redirectBack(null, { etsy: "error", error: "state_expired" });

    const projectRef = Deno.env.get("SUPABASE_URL")!.split("//")[1].split(".")[0];
    const redirectUri = `https://${projectRef}.functions.supabase.co/etsy-oauth-callback`;

    // Exchange code for tokens
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: apiKey,
      redirect_uri: redirectUri,
      code,
      code_verifier: pending.code_verifier as string,
    });
    const tokR = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });
    const tokTxt = await tokR.text();
    if (!tokR.ok) return redirectBack(pending.redirect_back, { etsy: "error", error: "token_exchange_failed" });
    const tok = JSON.parse(tokTxt) as { access_token: string; refresh_token: string; expires_in: number };

    let shopId = "";
    let shopName = "";
    let shopErr = "";
    try {
      const shopR = await fetch("https://openapi.etsy.com/v3/application/users/me/shops", {
        headers: { "x-api-key": apiKeyCombined, Authorization: `Bearer ${tok.access_token}` },
      });
      const shopTxt = await shopR.text();
      if (shopR.ok) {
        const shopD = JSON.parse(shopTxt);
        const shop = extractShop(shopD);
        shopId = String(shop?.shop_id ?? "");
        shopName = String(shop?.shop_name ?? "");
      } else if (shopR.status === 400 && /Expected int value/i.test(shopTxt)) {
        const userId = tok.access_token.split(".")[0];
        const fallbackR = await fetch(`https://openapi.etsy.com/v3/application/users/${userId}/shops`, {
          headers: { "x-api-key": apiKeyCombined, Authorization: `Bearer ${tok.access_token}` },
        });
        const fallbackTxt = await fallbackR.text();
        if (fallbackR.ok) {
          const shop = extractShop(JSON.parse(fallbackTxt));
          shopId = String(shop?.shop_id ?? "");
          shopName = String(shop?.shop_name ?? "");
        } else {
          shopErr = `${fallbackR.status}: ${fallbackTxt}`;
        }
      } else {
        shopErr = `${shopR.status}: ${shopTxt}`;
      }
    } catch (e) { shopErr = (e as Error).message; }

    await sb.from("etsy_oauth_tokens").upsert({
      key: "default",
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
      shop_id: shopId || null,
      updated_at: new Date().toISOString(),
    });

    await sb.from("etsy_oauth_pending").delete().eq("state", state);

    const syncPromise = fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/etsy-product-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` },
      body: JSON.stringify({ limit: 500 }),
    }).then(async (r) => console.log("etsy post-oauth sync", r.status, await r.text())).catch((e) => console.error("etsy post-oauth sync failed", e.message));
    EdgeRuntime.waitUntil(syncPromise);

    return redirectBack(pending.redirect_back, {
      etsy: "connected",
      shop_id: shopId || "unknown",
      shop: shopName || "unknown",
      sync: "started",
    });
  } catch (e) {
    return html(`<h2>Error</h2><pre>${(e as Error).message}</pre>`, 500);
  }
});
