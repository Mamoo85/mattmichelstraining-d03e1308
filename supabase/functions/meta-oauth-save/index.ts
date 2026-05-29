// meta-oauth-save — receives token from popup flow, verifies + saves it
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const { token } = await req.json();
  if (!token) return new Response(JSON.stringify({ error: "no token" }), { headers: { ...cors, "Content-Type": "application/json" } });

  // Verify + get permissions
  const [meRes, permsRes, adsRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${token}`),
    fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${token}`),
    fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${token}`),
  ]);

  const me = await meRes.json();
  const perms = await permsRes.json();
  const ads = await adsRes.json();

  const granted = (perms.data ?? []).filter((p: { status: string }) => p.status === "granted").map((p: { permission: string }) => p.permission);
  const adAccounts = ads.data ?? [];

  if (me.error) {
    return new Response(JSON.stringify({ error: me.error.message }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Save token via Supabase Management API
  const supabaseAccessToken = Deno.env.get("SUPABASE_ACCESS_TOKEN");
  if (!supabaseAccessToken) {
    return new Response(JSON.stringify({ error: "SUPABASE_ACCESS_TOKEN is not configured" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  await fetch(`https://api.supabase.com/v1/projects/zmyczlfuufhngzovkjdh/secrets`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ name: "META_USER_ACCESS_TOKEN", value: token }]),
  });

  console.log(`[META-SAVE] Token saved for ${me.name}, perms: ${granted.join(",")}, ad accounts: ${adAccounts.length}`);

  return new Response(JSON.stringify({
    success: true,
    name: me.name,
    permissions: granted,
    adAccounts: adAccounts.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })),
    hasAds: granted.includes("ads_management") || granted.includes("ads_read"),
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
