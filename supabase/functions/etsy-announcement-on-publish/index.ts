// Called fire-and-forget by printify-direct-publish whenever a new
// product successfully ships to Etsy. Queues a "new drop" announcement.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: { title?: string; product_type?: string; listing_id?: string | number } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const title = (body.title ?? "").slice(0, 80);
  if (!title) return new Response(JSON.stringify({ skipped: "no_title" }), { headers: corsHeaders });

  const copy = `✨ Just dropped: ${title} — shop now!`.slice(0, 250);

  // Queue a high-priority new_drop entry that expires in 48 hours
  const ends_at = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  await sb.from("etsy_announcement_schedule").insert({
    kind: "new_drop",
    copy,
    ends_at,
    priority: 80,
    active: true,
    meta: { product_type: body.product_type, listing_id: body.listing_id },
  });

  // Trigger rotator immediately so banner updates without waiting for cron
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/etsy-announcement-rotator`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
    body: "{}",
  }).catch(() => {});

  return new Response(JSON.stringify({ ok: true, queued: copy }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
