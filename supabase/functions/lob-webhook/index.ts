/**
 * lob-webhook
 * Receives Lob postcard tracking events.
 * Updates postcard_send_log delivery_status + delivered_at.
 * Aggregates delivered_count + returned_count back to postcard_campaigns.
 *
 * Supported events:
 *  - postcard.created
 *  - postcard.rendered_pdf
 *  - postcard.processed_for_delivery
 *  - postcard.in_transit
 *  - postcard.in_local_area
 *  - postcard.delivered
 *  - postcard.re-routed
 *  - postcard.returned_to_sender
 *
 * Webhook URL: https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/lob-webhook
 * Configure in Lob Dashboard → Settings → Webhooks
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, lob-signature",
};

// Map Lob event types → our delivery_status enum-ish values
function mapEventToStatus(eventType: string): string | null {
  if (eventType.includes("delivered")) return "delivered";
  if (eventType.includes("returned_to_sender")) return "returned";
  if (eventType.includes("re-routed") || eventType.includes("re_routed")) return "rerouted";
  if (eventType.includes("in_transit") || eventType.includes("in_local_area")) return "in_transit";
  if (eventType.includes("processed_for_delivery")) return "processed";
  if (eventType.includes("rendered")) return "rendered";
  if (eventType.includes("created")) return "queued";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const event = await req.json();
    // Lob webhook payload shape: { event_type: { id }, body: { id, ... }, reference_id, ... }
    const eventType: string = event?.event_type?.id || event?.event_type || "unknown";
    const lobBody = event?.body || event;
    const lobId: string = lobBody?.id || "";

    if (!lobId) {
      return new Response(JSON.stringify({ ok: false, error: "no lob id in payload" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newStatus = mapEventToStatus(eventType);
    if (!newStatus) {
      return new Response(JSON.stringify({ ok: true, ignored: eventType }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find the send log row by lob_id
    const { data: logRow } = await sb.from("postcard_send_log").select("*").eq("lob_id", lobId).maybeSingle();
    if (!logRow) {
      return new Response(JSON.stringify({ ok: false, error: "lob_id not found in send_log" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Append this event to tracking_events
    const events = Array.isArray(logRow.tracking_events) ? logRow.tracking_events : [];
    events.push({ at: new Date().toISOString(), event: eventType, status: newStatus });

    const updates: any = {
      delivery_status: newStatus,
      tracking_events: events,
    };
    if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();
    if (lobBody.expected_delivery_date && !logRow.expected_delivery_date) {
      updates.expected_delivery_date = lobBody.expected_delivery_date;
    }

    await sb.from("postcard_send_log").update(updates).eq("id", logRow.id);

    // Aggregate back to campaign
    if (logRow.campaign_id && (newStatus === "delivered" || newStatus === "returned")) {
      const field = newStatus === "delivered" ? "delivered_count" : "returned_count";
      const { data: campaign } = await sb.from("postcard_campaigns").select(field).eq("id", logRow.campaign_id).single();
      const current = (campaign as any)?.[field] || 0;
      await sb.from("postcard_campaigns").update({ [field]: current + 1 }).eq("id", logRow.campaign_id);
    }

    return new Response(JSON.stringify({ ok: true, lob_id: lobId, status: newStatus }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 200, // return 200 so Lob doesn't retry-storm
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
