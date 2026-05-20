// Shared helper: fetch a valid Etsy OAuth2 access token, refreshing if expired.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";

export interface EtsyAuth {
  apiKey: string;       // keystring (x-api-key)
  accessToken: string;  // bearer
  shopId: string;
}

export async function getEtsyAuth(sb?: SupabaseClient): Promise<EtsyAuth> {
  const apiKey = Deno.env.get("ETSY_API_KEY") ?? "";
  if (!apiKey) throw new Error("ETSY_API_KEY missing");

  const client = sb ?? createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: row } = await client
    .from("etsy_oauth_tokens")
    .select("*")
    .eq("key", "default")
    .maybeSingle();

  // Fallback: if no DB row, use legacy env-var token
  if (!row) {
    const envTok = Deno.env.get("ETSY_ACCESS_TOKEN") ?? "";
    const envShop = Deno.env.get("ETSY_SHOP_ID") ?? "";
    if (!envTok) throw new Error("No Etsy OAuth row and no ETSY_ACCESS_TOKEN env. Click 'Connect Etsy' in admin.");
    return { apiKey, accessToken: envTok, shopId: envShop };
  }

  let accessToken = row.access_token as string;
  const expiresAt = new Date(row.expires_at as string).getTime();

  // Refresh if <60s remaining
  if (expiresAt - Date.now() < 60_000) {
    const refreshed = await refreshEtsyToken(apiKey, row.refresh_token as string);
    accessToken = refreshed.access_token;
    await client.from("etsy_oauth_tokens").update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("key", "default");
  }

  const shopId = (row.shop_id as string) || Deno.env.get("ETSY_SHOP_ID") || "";
  return { apiKey, accessToken, shopId };
}

async function refreshEtsyToken(apiKey: string, refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: apiKey,
    refresh_token: refreshToken,
  });
  const r = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`etsy refresh failed: ${r.status} ${txt}`);
  return JSON.parse(txt) as { access_token: string; refresh_token: string; expires_in: number };
}
