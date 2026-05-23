// gng-price-floor-queue — calculates floor = cost*2.4 + $4.50 and queues SMS approvals for under-priced listings.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const ADMIN_PHONE = "+13139921219";
const FLOOR_MULT = 2.4;
const FLOOR_ADD_CENTS = 450;

const shortCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

async function sms(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const tok = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!sid || !tok || !from) return;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: printify } = await sb
    .from("printify_products")
    .select("etsy_listing_id,price_cents,cost_cents,title")
    .not("etsy_listing_id", "is", null)
    .not("cost_cents", "is", null);

  const queued: any[] = [];
  for (const p of printify ?? []) {
    const floor = Math.round((p.cost_cents ?? 0) * FLOOR_MULT) + FLOOR_ADD_CENTS;
    const current = p.price_cents ?? 0;
    if (current >= floor) continue;
    const gap = floor - current;
    if (gap < 100) continue; // skip <$1 raises
    const code = shortCode();
    await sb.from("gng_approvals").insert({
      short_code: code,
      kind: "price_floor",
      summary: `Floor "${(p.title ?? "").slice(0, 40)}" $${(current / 100).toFixed(2)} → $${(floor / 100).toFixed(2)}`,
      listing_id: p.etsy_listing_id,
      payload: { listing_id: p.etsy_listing_id, new_price_cents: floor, old_price_cents: current, cost_cents: p.cost_cents },
      notify_phone: ADMIN_PHONE,
    });
    queued.push({ code, gap });
    if (queued.length >= 25) break; // batch cap
  }

  if (queued.length) {
    const recovered = queued.reduce((s, q) => s + q.gap, 0) / 100;
    await sms(
      ADMIN_PHONE,
      `💰 GNG price floor: ${queued.length} listings below cost×2.4+$4.50.\nRecoverable margin/sale: $${recovered.toFixed(2)}\nReply YES ALL to fix every one, or YES <code> for individual review.`,
    );
  }

  return new Response(JSON.stringify({ queued: queued.length }), { headers: { ...cors, "Content-Type": "application/json" } });
});
