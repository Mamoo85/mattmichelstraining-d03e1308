import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAILS = ["matthewmichels4@gmail.com", "info@mattmichelstraining.com"];

async function sendEmail(to: string | string[], subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  const recipients = Array.isArray(to) ? to : [to];
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "M² Training <notify@mattmichelstraining.com>", to: recipients, subject, html }),
    });
  } catch (e) { console.error("Email error:", e); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { session_id } = await req.json();
    if (!session_id) throw new Error("Missing session_id");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") throw new Error("Payment not completed");

    const meta = session.metadata!;
    if (meta.type !== "training_session") throw new Error("Invalid session type");

    // Check if already verified
    const { data: existing } = await supabaseAdmin
      .from("session_bookings")
      .select("id")
      .eq("stripe_session_id", session_id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ success: true, already_verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slotIds: string[] = JSON.parse(meta.slot_ids);
    const durationMinutes = parseInt(meta.duration_minutes);
    const amountCents = durationMinutes === 60 ? 9000 : 5000;
    const isGuest = meta.is_guest === "true" || meta.user_id === "guest";

    // Use a placeholder user_id for guest bookings
    // The session_bookings table requires user_id, so for guests we store "guest" marker
    const bookingUserId = isGuest ? "00000000-0000-0000-0000-000000000000" : meta.user_id;

    // Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("session_bookings")
      .insert({
        user_id: bookingUserId,
        slot_date: meta.slot_date,
        start_time: meta.start_time,
        duration_minutes: durationMinutes,
        amount_cents: amountCents,
        session_type: meta.session_type || "in_person",
        stripe_session_id: session_id,
        stripe_payment_intent_id: session.payment_intent as string,
        user_email: meta.user_email,
        user_name: meta.user_name,
        status: "confirmed",
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Mark slots as booked
    for (const slotId of slotIds) {
      await supabaseAdmin
        .from("schedule_slots")
        .update({ booked_by: bookingUserId, booking_id: booking.id })
        .eq("id", slotId);
    }

    // Format for emails
    const [h, m] = meta.start_time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const timeStr = `${h12}:${m} ${ampm}`;
    const dateObj = new Date(meta.slot_date + "T12:00:00");
    const dateStr = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const durationStr = durationMinutes === 60 ? "1 Hour" : "30 Minutes";
    const priceStr = `$${(amountCents / 100).toFixed(0)}`;
    const guestTag = isGuest ? " (Guest — no account)" : "";

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#000;">M² Training Session Confirmed</h2>
        <div style="background:#f5f5f5;padding:15px;margin:15px 0;">
          <p><strong>Date:</strong> ${dateStr}</p>
          <p><strong>Time:</strong> ${timeStr}</p>
          <p><strong>Duration:</strong> ${durationStr}</p>
          <p><strong>Type:</strong> ${meta.session_type === "video" ? "Video Call" : "In-Person"}</p>
          <p><strong>Price:</strong> ${priceStr}</p>
        </div>
        <p><strong>Client:</strong> ${meta.user_name || meta.user_email}${guestTag}</p>
        <p><strong>Email:</strong> ${meta.user_email}</p>
        <p style="color:#666;font-size:12px;margin-top:20px;">
          15121 Kercheval Ave, Grosse Pointe Park, MI 48230 · (313) 806-4952
        </p>
      </div>`;

    // Send confirmation to client
    await sendEmail(meta.user_email, `Session Confirmed — ${dateStr} at ${timeStr}`, emailHtml);
    await sendEmail(ADMIN_EMAILS, `NEW SESSION BOOKED — ${meta.user_name || meta.user_email}${guestTag} · ${dateStr} ${timeStr}`, emailHtml);

    // Sync to Google Calendar (fire-and-forget)
    try {
      const gcalUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync`;
      await fetch(gcalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ action: "create_event", booking_id: booking.id }),
      });
    } catch (e) { console.error("GCal sync error:", e); }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
