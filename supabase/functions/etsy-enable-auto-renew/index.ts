// Ensures every active Etsy listing has should_auto_renew=true so Etsy's native 4-month auto-renewal kicks in.
// Cron: daily. Manual: POST {}.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getEtsyAuth } from "../_shared/etsy-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dry_run === true;
    const limit = Math.min(Number(body.limit ?? 200), 500);

    const { apiKey, accessToken, shopId } = await getEtsyAuth(sb);
    if (!shopId) throw new Error("shop_id_missing");

    // Find active listings whose raw.should_auto_renew is falsy
    const { data: listings, error } = await sb
      .from("etsy_products")
      .select("listing_id,title,raw")
      .eq("state", "active")
      .limit(limit);
    if (error) throw error;

    const needsUpdate = (listings ?? []).filter((l: any) => l.raw?.should_auto_renew !== true);

    let updated = 0;
    const errors: any[] = [];

    if (!dryRun) {
      for (const l of needsUpdate) {
        try {
          const url = `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${l.listing_id}`;
          const formBody = new URLSearchParams({ should_auto_renew: "true" });
          const r = await fetch(url, {
            method: "PATCH",
            headers: {
              "x-api-key": apiKey,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formBody.toString(),
          });
          if (!r.ok) {
            const t = await r.text();
            errors.push({ listing_id: l.listing_id, error: `etsy_${r.status}: ${t.slice(0, 150)}` });
            continue;
          }
          updated++;
          await SLEEP(300);
        } catch (e) {
          errors.push({ listing_id: l.listing_id, error: (e as Error).message.slice(0, 200) });
        }
      }
    }

    await sb.from("gng_auto_renew_log").insert({
      listings_scanned: (listings ?? []).length,
      listings_updated: updated,
      errors: errors as any,
    });

    return new Response(JSON.stringify({
      ok: true,
      scanned: (listings ?? []).length,
      already_auto_renew: (listings ?? []).length - needsUpdate.length,
      needs_update: needsUpdate.length,
      updated,
      errors: errors.slice(0, 20),
      dry_run: dryRun,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
