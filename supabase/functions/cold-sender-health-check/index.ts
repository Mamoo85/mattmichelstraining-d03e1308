// cold-sender-health-check
// Daily 8am ET. If yesterday's total cold sends < 50% of daily_cap, SMS Matt.
// This is the alarm that would have caught the May 19→24 blackout.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: rs } = await sb.from("cold_email_ramp_state").select("*").eq("id", 1).maybeSingle();
    const dailyCap = (rs?.current_cap as number) ?? 50;

    const yStart = new Date(); yStart.setUTCHours(0, 0, 0, 0); yStart.setUTCDate(yStart.getUTCDate() - 1);
    const yEnd = new Date(yStart); yEnd.setUTCDate(yEnd.getUTCDate() + 1);

    const { count: sent } = await sb
      .from("outreach_send_queue")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email")
      .eq("status", "sent")
      .gte("sent_at", yStart.toISOString())
      .lt("sent_at", yEnd.toISOString());

    const sentN = sent || 0;
    const threshold = Math.floor(dailyCap * 0.5);
    const ok = sentN >= threshold;

    if (!ok) {
      const msg = `🚨 Cold email blackout alert: yesterday sent ${sentN} of ${dailyCap} (cap). Threshold ${threshold}. Check /dwa-admin or cold-sender-master logs.`;
      await sendSMS(ADMIN_PHONE, TWILIO_FROM, msg, "cold_sender_health_check").catch(() => {});
    }

    return new Response(JSON.stringify({ ok, dailyCap, sentYesterday: sentN, threshold }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
