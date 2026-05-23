// gng-drift-detector — finds Etsy prices that drifted from Printify "source of truth".
// Queues SMS approval to Matt instead of auto-reverting.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const ADMIN_PHONE = "+13139921219"; // DWA/Matt — Etsy business line per user

const shortCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

async function sms(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const tok = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!sid || !tok || !from) return { ok: false, err: "twilio_missing" };
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${tok}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  return { ok: r.ok, status: r.status, body: (await r.text()).slice(0, 200) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Pull Etsy + Printify, find drift > $0.50.
  const { data: etsy } = await sb
    .from("etsy_products")
    .select("listing_id,title,price_cents,url")
    .eq("state", "active")
    .limit(2000);
  const { data: printify } = await sb
    .from("printify_products")
    .select("etsy_listing_id,product_id,price_cents,cost_cents,title")
    .not("etsy_listing_id", "is", null);

  const pMap = new Map<number, any>();
  (printify ?? []).forEach((p: any) => pMap.set(Number(p.etsy_listing_id), p));

  const drifted: any[] = [];
  for (const e of etsy ?? []) {
    const p = pMap.get(Number(e.listing_id));
    if (!p || p.price_cents == null || e.price_cents == null) continue;
    const drift = (e.price_cents ?? 0) - (p.price_cents ?? 0);
    if (Math.abs(drift) < 50) continue;
    drifted.push({ e, p, drift });
  }

  // Take top 10 largest losses (negative drift = under-priced on Etsy).
  drifted.sort((a, b) => a.drift - b.drift);
  const top = drifted.slice(0, 10);

  const queued: any[] = [];
  for (const { e, p, drift } of top) {
    await sb.from("gng_drift_snapshots").insert({
      listing_id: e.listing_id,
      printify_product_id: p.product_id,
      etsy_price_cents: e.price_cents,
      printify_price_cents: p.price_cents,
      drift_cents: drift,
      cost_cents: p.cost_cents,
    });
    const code = shortCode();
    await sb.from("gng_approvals").insert({
      short_code: code,
      kind: "drift_fix",
      summary: `Raise "${(e.title ?? "").slice(0, 40)}" $${(e.price_cents / 100).toFixed(2)} → $${(p.price_cents / 100).toFixed(2)}`,
      listing_id: e.listing_id,
      payload: { listing_id: e.listing_id, new_price_cents: p.price_cents, old_price_cents: e.price_cents },
      notify_phone: ADMIN_PHONE,
    });
    queued.push({ code, listing_id: e.listing_id, drift });
  }

  if (queued.length) {
    const totalLoss = queued.reduce((s, q) => s + Math.abs(q.drift), 0) / 100;
    const lines = queued.slice(0, 5).map((q) => `${q.code} $${Math.abs(q.drift / 100).toFixed(2)}`).join("\n");
    await sms(
      ADMIN_PHONE,
      `🧶 GNG drift: ${queued.length} listings under-priced, recovering $${totalLoss.toFixed(2)}.\n${lines}\nReply: YES <code> to fix, NO <code> to skip, YES ALL to approve all.`,
    );
  }

  return new Response(JSON.stringify({ scanned: etsy?.length ?? 0, drifted: drifted.length, queued: queued.length }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
