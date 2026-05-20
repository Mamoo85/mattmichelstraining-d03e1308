// Update Etsy shop title and/or announcement, logging every push.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY")!;
  const ETSY_ACCESS_TOKEN = Deno.env.get("ETSY_ACCESS_TOKEN")!;
  const ETSY_SHOP_ID = Deno.env.get("ETSY_SHOP_ID")!;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: { title?: string; announcement?: string; editor_id?: string; trigger?: string; schedule_id?: string } = {};
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "bad_json" }), { status: 400, headers: corsHeaders }); }

  const updates: Record<string, string> = {};
  if (typeof body.title === "string") updates.title = body.title.slice(0, 55);
  if (typeof body.announcement === "string") updates.announcement = body.announcement.slice(0, 2200);
  if (Object.keys(updates).length === 0) return new Response(JSON.stringify({ error: "nothing_to_update" }), { status: 400, headers: corsHeaders });

  // Read current values so we can log before/after
  let current: any = {};
  try {
    const r = await fetch(`https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}`, {
      headers: { "x-api-key": ETSY_API_KEY, Authorization: `Bearer ${ETSY_ACCESS_TOKEN}` },
    });
    if (r.ok) current = await r.json();
  } catch (_) { /* best effort */ }

  // Etsy v3 shop update uses application/x-www-form-urlencoded
  const form = new URLSearchParams(updates);
  const r = await fetch(`https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}`, {
    method: "PUT",
    headers: {
      "x-api-key": ETSY_API_KEY,
      Authorization: `Bearer ${ETSY_ACCESS_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const respText = await r.text();
  const ok = r.ok;

  // Audit log
  for (const [field, val] of Object.entries(updates)) {
    await sb.from("etsy_shop_edits").insert({
      edited_by: body.editor_id ?? null,
      field,
      previous_value: current?.[field] ?? null,
      new_value: val,
      pushed_ok: ok,
      error_message: ok ? null : respText.slice(0, 500),
    });
  }
  if (updates.announcement) {
    await sb.from("etsy_announcement_log").insert({
      schedule_id: body.schedule_id ?? null,
      trigger: body.trigger ?? "manual",
      copy: updates.announcement,
      pushed_ok: ok,
      error_message: ok ? null : respText.slice(0, 500),
    });
  }

  return new Response(JSON.stringify({ ok, status: r.status, response: respText.slice(0, 500) }), {
    status: ok ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
