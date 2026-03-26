import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
      body: JSON.stringify({ from: "M² Training <onboarding@resend.dev>", to: recipients, subject, html }),
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
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { slot_date, start_time, session_type, gift_id } = await req.json();
    if (!slot_date || !start_time || !["in_person", "video"].includes(session_type)) {
      throw new Error("Invalid request");
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_tier, full_name, athlete_name")
      .eq("user_id", user.id)
      .single();

    let redemptionType: "credit" | "gift" = "credit";
    let creditId: string | null = null;

    if (gift_id) {
      // ── GIFTED SESSION REDEMPTION ──
      redemptionType = "gift";

      // Verify the gift exists and is pending for this user
      const { data: gift } = await supabaseAdmin
        .from("gifted_sessions")
        .select("*")
        .eq("id", gift_id)
        .eq("status", "pending")
        .single();

      if (!gift) throw new Error("No valid gifted session found");

      // Verify receiver matches (by claimed_by or receiver_email)
      if (gift.claimed_by && gift.claimed_by !== user.id) {
        throw new Error("This gift is not for your account");
      }
      if (!gift.claimed_by && gift.receiver_email !== user.email) {
        throw new Error("This gift is not for your account");
      }
    } else {
      // ── ELITE CREDIT REDEMPTION ──
      const eliteTiers = ["custom", "team_elite"];
      if (!profile || !eliteTiers.includes(profile.subscription_tier)) {
        throw new Error("Session credits are only available for Custom and Team/Elite subscribers");
      }

      // Check for available credit this month
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Ensure credit exists for this month (auto-grant)
      await supabaseAdmin.from("session_credits").upsert({
        user_id: user.id,
        credit_type: "30_min",
        month: currentMonth,
        year: currentYear,
        source: "subscription",
      }, { onConflict: "user_id,credit_type,month,year", ignoreDuplicates: true });

      // Fetch the credit
      const { data: credit } = await supabaseAdmin
        .from("session_credits")
        .select("*")
        .eq("user_id", user.id)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .eq("is_used", false)
        .single();

      if (!credit) throw new Error("No available session credit this month");
      creditId = credit.id;
    }

    // Check slot availability (30 min only for credits/gifts)
    const { data: slotsData } = await supabaseAdmin
      .from("schedule_slots")
      .select("*")
      .eq("slot_date", slot_date)
      .eq("start_time", start_time)
      .eq("is_available", true)
      .is("booked_by", null);

    if (!slotsData || slotsData.length === 0) {
      throw new Error("Selected slot is no longer available");
    }

    // Check 2.5 hour cutoff
    const slotDateTime = new Date(`${slot_date}T${start_time}`);
    if (slotDateTime.getTime() - Date.now() < 2.5 * 60 * 60 * 1000) {
      throw new Error("Slots must be booked at least 2.5 hours in advance");
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("session_bookings")
      .insert({
        user_id: user.id,
        slot_date,
        start_time,
        duration_minutes: 30,
        amount_cents: 0,
        session_type,
        credit_id: creditId,
        user_email: user.email,
        user_name: profile?.full_name || profile?.athlete_name || "",
        status: "confirmed",
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    if (redemptionType === "gift" && gift_id) {
      // Mark gift as claimed
      await supabaseAdmin
        .from("gifted_sessions")
        .update({
          status: "claimed",
          claimed_by: user.id,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", gift_id);
    } else if (creditId) {
      // Mark credit as used
      await supabaseAdmin
        .from("session_credits")
        .update({ is_used: true, used_at: new Date().toISOString(), booking_id: booking.id })
        .eq("id", creditId);
    }

    // Mark slot as booked
    await supabaseAdmin
      .from("schedule_slots")
      .update({ booked_by: user.id, booking_id: booking.id })
      .eq("id", slotsData[0].id);

    // Format for emails
    const [h, m] = start_time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const timeStr = `${h12}:${m} ${ampm}`;
    const dateObj = new Date(slot_date + "T12:00:00");
    const dateStr = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const typeLabel = session_type === "video" ? "Video Call" : "In-Person";
    const sourceLabel = redemptionType === "gift" ? "Gifted Session" : "Elite Membership Credit";

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#000;">M² ${typeLabel} Session Confirmed</h2>
        <div style="background:#f5f5f5;padding:15px;margin:15px 0;">
          <p><strong>Date:</strong> ${dateStr}</p>
          <p><strong>Time:</strong> ${timeStr}</p>
          <p><strong>Duration:</strong> 30 Minutes</p>
          <p><strong>Type:</strong> ${typeLabel}</p>
          <p><strong>Price:</strong> Included (${sourceLabel})</p>
        </div>
        <p><strong>Client:</strong> ${profile?.full_name || profile?.athlete_name || user.email}</p>
        <p style="color:#666;font-size:12px;margin-top:20px;">
          15121 Kercheval Ave, Grosse Pointe Park, MI 48230 · (313) 806-4952
        </p>
      </div>`;

    await sendEmail(user.email, `Session Confirmed — ${dateStr} at ${timeStr}`, emailHtml);
    await sendEmail(ADMIN_EMAILS, `${sourceLabel.toUpperCase()} SESSION — ${profile?.full_name || user.email} · ${dateStr} ${timeStr} (${typeLabel})`, emailHtml);

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
