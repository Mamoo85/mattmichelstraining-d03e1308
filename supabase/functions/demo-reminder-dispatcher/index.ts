import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

// America/Detroit is UTC-4 (EDT) May–Nov, UTC-5 (EST) Nov–Mar.
// We compute slot UTC by reading the offset from a constructed Date.
function slotToUtc(slot_date: string, slot_time: string): Date {
  // Build a "wall clock" Date in ET by trial: start with an ISO string assuming -04:00
  const guess = new Date(`${slot_date}T${slot_time}:00-04:00`);
  // Ask the env what offset that wall clock actually is in ET — if -05:00 (EST), correct by adding an hour.
  const tzName = guess.toLocaleString("en-US", { timeZone: "America/Detroit", timeZoneName: "short" });
  if (tzName.includes("EST")) {
    return new Date(`${slot_date}T${slot_time}:00-05:00`);
  }
  return guess;
}

function fmtSlot(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = Date.now();
    const WINDOW = 15 * 60 * 1000; // ±15 min

    // Pull upcoming bookings within 26h that still need reminders
    const startDate = new Date(now - 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = new Date(now + 26 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: bookings, error } = await sb
      .from("demo_bookings")
      .select("id,prospect_name,prospect_email,company,phone,slot_date,slot_time,reminder_24h_sent_at,reminder_1h_sent_at,status")
      .gte("slot_date", startDate)
      .lte("slot_date", endDate)
      .in("status", ["confirmed", "rescheduled"]);
    if (error) throw error;

    const results: Array<{ id: string; type: string; status: string; error?: string }> = [];

    for (const b of bookings ?? []) {
      const slotUtc = slotToUtc(b.slot_date as string, b.slot_time as string);
      const msUntil = slotUtc.getTime() - now;
      const first = (b.prospect_name as string | null)?.split(" ")[0] || "there";
      const company = (b.company as string | null) || "your business";
      const slotNice = fmtSlot(slotUtc);
      const phone = b.phone as string | null;

      // 24h reminder: 23h45m–24h15m out, prospect SMS only (skip if no phone)
      if (!b.reminder_24h_sent_at && Math.abs(msUntil - 24 * 60 * 60 * 1000) <= WINDOW && phone) {
        const body = `Hey ${first}, Matt from Detroit Web Agency — quick reminder we're on tomorrow at ${slotNice} ET for your ${company} demo. Reply YES to confirm or text RESCHEDULE if you need a new time.`;
        try {
          await sendSMS(phone, TWILIO_FROM, body, "demo_reminder_24h");
          await sb.from("demo_bookings").update({ reminder_24h_sent_at: new Date().toISOString() }).eq("id", b.id);
          results.push({ id: b.id as string, type: "24h", status: "sent" });
        } catch (e) {
          results.push({ id: b.id as string, type: "24h", status: "failed", error: e instanceof Error ? e.message : String(e) });
        }
      }

      // 1h reminder: 45m–75m out, prospect SMS + Matt heads-up
      if (!b.reminder_1h_sent_at && Math.abs(msUntil - 60 * 60 * 1000) <= WINDOW) {
        if (phone) {
          const body = `60 min until our demo, ${first}! I'll call you at ${slotNice} ET. Need to reach me sooner? (313) 992-1219`;
          try { await sendSMS(phone, TWILIO_FROM, body, "demo_reminder_1h"); } catch { /* swallow per-prospect failures, still notify Matt */ }
        }
        const adminBody = `⏰ DEMO IN 1H\n${b.prospect_name || "?"}${company !== "your business" ? ` (${company})` : ""}\n${slotNice} ET\n${b.prospect_email}${phone ? ` · ${phone}` : ""}`;
        try { await sendSMS(ADMIN_PHONE, TWILIO_FROM, adminBody, "demo_reminder_1h_admin"); } catch { /* */ }
        await sb.from("demo_bookings").update({ reminder_1h_sent_at: new Date().toISOString() }).eq("id", b.id);
        results.push({ id: b.id as string, type: "1h", status: "sent" });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: bookings?.length ?? 0, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
