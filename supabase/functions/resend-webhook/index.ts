import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  // Resend sends POST webhooks
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const { type, data } = payload;

    // We care about: email.opened, email.clicked, email.bounced, email.delivery_delayed, email.complained
    const eventMap: Record<string, string> = {
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.delivered": "delivered",
    };

    const status = eventMap[type];
    if (!status || !data?.email_id) {
      // Not an event we track — acknowledge anyway
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resendId = data.email_id;

    // Update prospect_email_log if this resend_id exists
    const updateFields: Record<string, any> = { status };
    if (status === "opened") updateFields.opened_at = new Date().toISOString();
    if (status === "clicked") updateFields.clicked_at = new Date().toISOString();

    const { data: updated, error } = await sb
      .from("prospect_email_log")
      .update(updateFields)
      .eq("resend_id", resendId)
      .select("id");

    console.log(`[RESEND-WEBHOOK] type=${type} resend_id=${resendId} matched=${updated?.length || 0}`, error ? `error: ${error.message}` : "");

    // SECURITY: Hard-bounces and spam complaints suppress the address permanently.
    // Prevents future Ingestion Pipeline sends to a known-dead or complaining endpoint.
    if (status === "bounced" || status === "complained") {
      const toAddress = Array.isArray(data?.to) ? data.to[0] : (data?.to || data?.email_address);
      if (toAddress) {
        await sb.from("suppressed_emails").upsert({
          email: String(toAddress).toLowerCase().trim(),
          reason: status === "bounced" ? "bounce" : "complaint",
          metadata: { resend_email_id: resendId, event_type: type },
        }, { onConflict: "email" }).catch((err: any) =>
          console.warn("[RESEND-WEBHOOK] suppression upsert failed:", err.message)
        );
        console.log(`[RESEND-WEBHOOK] Suppressed ${toAddress} (${status})`);
      }
    }

    return new Response(JSON.stringify({ received: true, matched: updated?.length || 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[RESEND-WEBHOOK] Error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
