// Pushes a radar lead to the client's configured CRM webhook (if any),
// and always logs a `crm_pushed` row in radar_lead_actions so the activity
// timeline shows the export.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { deliverCrmWebhook } from "../_shared/crm-webhook.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: cors });
  }
  try {
    const { signal_id, client_id, radar, payload } = await req.json();
    if (!signal_id || !client_id || !radar || !payload) {
      return new Response(JSON.stringify({ error: "bad input" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Look up client webhook config (industry_pulse_clients has crm_webhook_url/secret optional cols)
    let url: string | null = null;
    let secret: string | null = null;
    try {
      const { data: c } = await (sb.from as any)("industry_pulse_clients")
        .select("crm_webhook_url, crm_webhook_secret")
        .eq("id", client_id)
        .maybeSingle();
      url = (c as any)?.crm_webhook_url ?? null;
      secret = (c as any)?.crm_webhook_secret ?? null;
    } catch (_) { /* column may not exist — falls through to clipboard-only */ }

    let delivered = false;
    if (url) {
      await deliverCrmWebhook({ product: `radar_${radar}`, client_id, url, secret, payload });
      delivered = true;
    }

    await sb.from("radar_lead_actions").insert({
      signal_id: String(signal_id),
      client_id: String(client_id),
      radar: String(radar),
      action: "crm_pushed",
      notes: delivered ? "webhook" : "clipboard_fallback",
    });

    return new Response(JSON.stringify({ ok: true, delivered }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
