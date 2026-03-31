import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

async function sendEmail(to: string, subject: string, html: string) { + EMAIL_SIGNATURE
  if (!RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "M² Training <onboarding@resend.dev>", to: [to], subject, html }),
    });
  } catch (e) { console.error("Email error:", e); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { data: roleCheck } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!roleCheck) throw new Error("Admin access required");

    const { booking_id } = await req.json();
    if (!booking_id) throw new Error("Missing booking_id");

    // Get booking
    const { data: booking, error: bErr } = await supabaseAdmin
      .from("session_bookings")
      .select("*")
      .eq("id", booking_id)
      .single();
    if (bErr || !booking) throw new Error("Booking not found");
    if (booking.status === "cancelled") throw new Error("Already cancelled");

    // Refund via Stripe
    if (booking.stripe_payment_intent_id) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
      await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent_id });
    }

    // Update booking status
    await supabaseAdmin
      .from("session_bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", booking_id);

    // If booking used a credit, restore it
    if (booking.credit_id) {
      await supabaseAdmin
        .from("session_credits")
        .update({ is_used: false, used_at: null, booking_id: null })
        .eq("id", booking.credit_id);
    }

    // Remove Google Calendar event (fire-and-forget)
    if (booking.google_calendar_event_id) {
      try {
        const gcalUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync`;
        await fetch(gcalUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ action: "delete_event", booking_id }),
        });
      } catch (e) { console.error("GCal delete error:", e); }
    }

    // Free up slots
    await supabaseAdmin
      .from("schedule_slots")
      .update({ booked_by: null, booking_id: null })
      .eq("booking_id", booking_id);

    // Notify user
    if (booking.user_email) {
      const [h, m] = booking.start_time.split(":");
      const hour = parseInt(h);
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? "PM" : "AM";
      const timeStr = `${h12}:${m} ${ampm}`;
      const dateObj = new Date(booking.slot_date + "T12:00:00");
      const dateStr = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

      await sendEmail(
        booking.user_email,
        "Session Cancelled — Full Refund Issued",
        `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <h2 style="color:#000;">Session Cancelled</h2>
          <p>Your training session on <strong>${dateStr}</strong> at <strong>${timeStr}</strong> has been cancelled by Coach Matt.</p>
          <p>A <strong>full refund of $${(booking.amount_cents / 100).toFixed(0)}</strong> has been issued to your original payment method. It may take 5-10 business days to appear.</p>
          <p>We apologize for the inconvenience. Feel free to book another session at your convenience.</p>
          <p style="color:#666;font-size:12px;margin-top:20px;">M² Training · (313) 806-4952</p>
        </div>`
      );

      // Create notification
      await supabaseAdmin.from("notifications").insert({
        user_id: booking.user_id,
        type: "session_cancelled",
        title: "Session Cancelled",
        body: `Your session on ${dateStr} at ${timeStr} was cancelled. Full refund issued.`,
        link: "/schedule",
      });
    }

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
