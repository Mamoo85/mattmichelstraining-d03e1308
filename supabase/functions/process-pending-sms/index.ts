// process-pending-sms — minutely cron that delivers scheduled text messages
// Picks up rows from pending_sms where send_after <= now() and sent = false.
// Used by missed-call-status to implement the 5-minute delayed text-back.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (_req) => {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch pending messages that are ready to send (batch up to 50)
    const { data: rows, error } = await sb
      .from("pending_sms")
      .select("id, to_phone, from_phone, body, product")
      .eq("sent", false)
      .lte("send_after", new Date().toISOString())
      .order("send_after", { ascending: true })
      .limit(50);

    if (error) {
      console.error("[process-pending-sms] Query error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    console.log(`[process-pending-sms] Processing ${rows.length} pending SMS(es)`);

    let sent = 0;
    for (const row of rows) {
      // Mark as sent first to avoid double-send on retry
      await sb.from("pending_sms").update({ sent: true }).eq("id", row.id);

      const result = await sendSMS(row.to_phone, row.from_phone, row.body, row.product ?? "missed_call");
      if (result.success) {
        sent++;
        console.log(`[process-pending-sms] Sent to ${row.to_phone} — SID: ${result.sid}`);
      } else if (result.skipped) {
        console.log(`[process-pending-sms] Skipped ${row.to_phone} (opted out)`);
      } else {
        console.error(`[process-pending-sms] Failed for ${row.to_phone}: ${result.error}`);
        // Revert sent flag so it can be retried next minute
        await sb.from("pending_sms").update({ sent: false }).eq("id", row.id);
      }
    }

    return new Response(JSON.stringify({ processed: rows.length, sent }), { status: 200 });
  } catch (e: unknown) {
    console.error("[process-pending-sms] Fatal error:", e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500 });
  }
});
