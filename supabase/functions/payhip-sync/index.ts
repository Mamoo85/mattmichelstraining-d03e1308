// payhip-sync — UK/Australia/Canada digital product mirror
//
// Runs DAILY 5pm UTC via cron.
// Payhip: UK-based Gumroad alternative with strong UK/AU/CA buyer base
//   - 5% fee vs Gumroad 10%
//   - 130k+ sellers · UK buyer community skews premium
//   - Strong in creative/design communities (overlap with Etsy buyers)
//   - Automatic VAT for EU/UK digital goods
//
// SETUP (one-time, ~5 min):
//   1. Create account at payhip.com
//   2. Settings → Integrations → API → Generate Key
//   3. Set secret: PAYHIP_API_KEY
//
// Revenue: Additive — same products, new audience, lower fees.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PAYHIP_KEY    = Deno.env.get("PAYHIP_API_KEY") || "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") || "";
const OWNER_EMAIL   = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[PAYHIP] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

async function createPayhipProduct(product: {
  title: string; description: string; price_cents: number;
}): Promise<{ id: string; url: string }> {
  // Payhip uses GBP natively for UK buyers — convert USD to GBP pence
  const gbpPence = Math.round(product.price_cents * 0.80);

  const r = await fetch("https://payhip.com/api/v1/products", {
    method: "POST",
    headers: {
      "x-api-key": PAYHIP_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "digital_download",
      name: product.title,
      description: product.description,
      price: gbpPence,
      currency: "GBP",
      published: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const d = await r.json();
  if (!r.ok) throw new Error(`Payhip create failed: ${JSON.stringify(d).slice(0, 200)}`);

  return {
    id: d.id || d.product_id,
    url: d.link || `https://payhip.com/b/${d.id}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  log("Start sync");

  if (!PAYHIP_KEY) {
    return new Response(JSON.stringify({
      skipped: true,
      reason: "PAYHIP_API_KEY not set",
      setup: [
        "1. Create account at payhip.com (free)",
        "2. Settings → Integrations → API → Generate Key",
        "3. Set secret: PAYHIP_API_KEY",
      ],
      why: "130k+ sellers · UK/AU/CA buyer community · 5% fee (vs Gumroad 10%) · VAT auto-handled",
    }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  try {
    const { data: gumroadProducts } = await sb
      .from("gumroad_digital_products")
      .select("id, title, niche, price_cents, product_type")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: alreadySynced } = await sb.from("payhip_products" as any)
      .select("gumroad_product_id").limit(200);
    const syncedIds = new Set((alreadySynced || []).map((e: any) => e.gumroad_product_id));

    const toSync = (gumroadProducts || []).filter((p: any) => !syncedIds.has(p.id)).slice(0, 5);

    if (toSync.length === 0) {
      await sb.from("agent_heartbeats").upsert({
        agent_name: "payhip-sync",
        last_run_at: new Date().toISOString(),
        last_status: "idle",
        last_result: JSON.stringify({ synced: 0, message: "All products already on Payhip" }),
      }, { onConflict: "agent_name" });
      return new Response(JSON.stringify({ success: true, synced: 0, message: "All products already on Payhip" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const synced: string[] = [];
    const failed: string[] = [];

    for (const product of toSync) {
      try {
        const desc = `${product.niche || product.product_type || "business"} digital download — practical templates and guides. Instant access after purchase. UK customers: VAT included.`;

        const result = await createPayhipProduct({
          title: product.title,
          description: desc,
          price_cents: product.price_cents || 997,
        });

        await sb.from("payhip_products" as any).insert({
          gumroad_product_id: product.id,
          title: product.title,
          payhip_id: result.id,
          payhip_url: result.url,
          price_gbp_pence: Math.round((product.price_cents || 997) * 0.80),
          status: "active",
        }).catch(() => {});

        synced.push(product.title);
        log(`Synced: ${product.title}`);
      } catch (err) {
        log(`Failed: ${product.title}`, String(err).slice(0, 150));
        failed.push(product.title);
      }
    }

    if (RESEND_KEY && synced.length > 0) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Payhip Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `🇬🇧 ${synced.length} products live on Payhip (UK/AU market)`,
          html: `<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#3b82f6;">🇬🇧 Payhip Sync Complete</h2>
<p>${synced.length} products now live for UK/AU/CA buyers in GBP:</p>
<ul>${synced.map(t => `<li>${t}</li>`).join("")}</ul>
<p style="color:#94a3b8;font-size:12px;">5% fee · GBP pricing · UK VAT auto-handled</p>
</div>`,
        }),
      });
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "payhip-sync",
      last_run_at: new Date().toISOString(),
      last_status: synced.length > 0 ? "ok" : "idle",
      last_result: JSON.stringify({ synced: synced.length, failed: failed.length, titles: synced }),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ success: true, synced: synced.length, failed: failed.length, titles: synced }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("Error", String(err).slice(0, 300));
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
