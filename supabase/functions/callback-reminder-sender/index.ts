// callback-reminder-sender — cron every 5 min, fires SMS to Matt when a callback is due.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date().toISOString();

  const { data: due } = await sb
    .from("callback_reminders")
    .select("id, caller_number, context, scheduled_for")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .limit(10);

  for (const row of (due || []) as Array<{ id: string; caller_number: string; context: string; scheduled_for: string }>) {
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_PHONE,
      `📞 Callback now: ${row.caller_number} asked you to call at this time.\nTheir message: "${(row.context || "").slice(0, 80)}"\nTap to dial: tel:${row.caller_number}`,
      "callback_reminder",
      false,
      { bypassQuietHours: true }
    );
    await sb.from("callback_reminders").update({ status: "sent" }).eq("id", row.id);
  }

  return new Response(JSON.stringify({ ok: true, sent: (due || []).length }), {
    headers: { "Content-Type": "application/json" },
  });
});
