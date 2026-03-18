import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
const GOOGLE_PRIVATE_KEY_B64 = Deno.env.get("GOOGLE_PRIVATE_KEY_B64");

// Known service account details (non-sensitive)
const SERVICE_ACCOUNT_EMAIL = "m2-872@subtle-seer-490106-v4.iam.gserviceaccount.com";

// Get access token from service account
async function getGoogleAccessToken(): Promise<string> {
  let clientEmail = SERVICE_ACCOUNT_EMAIL;
  let pemBase64 = "";
  
  // Strategy 1: Use GOOGLE_PRIVATE_KEY_B64 (just the base64 key content, no PEM headers)
  if (GOOGLE_PRIVATE_KEY_B64) {
    pemBase64 = GOOGLE_PRIVATE_KEY_B64.replace(/\s/g, "");
    console.log("Using GOOGLE_PRIVATE_KEY_B64, length:", pemBase64.length, "starts:", pemBase64.substring(0, 30));
  }
  // Strategy 2: Try parsing GOOGLE_SERVICE_ACCOUNT_KEY as full JSON
  else if (GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const key = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
      clientEmail = key.client_email || SERVICE_ACCOUNT_EMAIL;
      pemBase64 = key.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/[\n\r\s]/g, "");
    } catch {
      // Treat as raw private key content
      const raw = GOOGLE_SERVICE_ACCOUNT_KEY.trim();
      pemBase64 = raw
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/[\n\r\s]/g, "")
        .replace(/^n/, ""); // strip leading 'n' from escaped \n
    }
  } else {
    throw new Error("Google service account not configured - set GOOGLE_PRIVATE_KEY_B64 or GOOGLE_SERVICE_ACCOUNT_KEY");
  }

  if (!pemBase64) throw new Error("Private key not found");

  // Create JWT
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claim = btoa(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    sub: clientEmail,
  }));

  // Import private key and sign
  const binaryKey = Uint8Array.from(atob(pemBase64), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signatureInput = new TextEncoder().encode(`${header}.${claim}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signatureInput);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${header}.${claim}.${signatureB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Failed to get Google access token: " + JSON.stringify(tokenData));
  return tokenData.access_token;
}

// Create a Google Calendar event from a booking
async function createCalendarEvent(accessToken: string, booking: any) {
  const startDateTime = `${booking.slot_date}T${booking.start_time}`;
  const endMinutes = booking.duration_minutes || 30;
  const [h, m] = booking.start_time.split(":").map(Number);
  const endTotal = h * 60 + m + endMinutes;
  const endTime = `${Math.floor(endTotal / 60).toString().padStart(2, "0")}:${(endTotal % 60).toString().padStart(2, "0")}:00`;
  const endDateTime = `${booking.slot_date}T${endTime}`;

  const typeLabel = booking.session_type === "video" ? "Video" : "In-Person";
  const clientName = booking.user_name || booking.user_email || "Client";

  const event = {
    summary: `M² Session: ${clientName} (${typeLabel})`,
    description: `${endMinutes}-min ${typeLabel} training session\nClient: ${clientName}\nEmail: ${booking.user_email || "N/A"}\n${booking.credit_id ? "Paid via: Elite Credit" : `Amount: $${(booking.amount_cents / 100).toFixed(0)}`}`,
    start: { dateTime: startDateTime, timeZone: "America/Detroit" },
    end: { dateTime: endDateTime, timeZone: "America/Detroit" },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`Google Calendar API error: ${JSON.stringify(data)}`);
  return data.id;
}

// Delete a Google Calendar event
async function deleteCalendarEvent(accessToken: string, eventId: string) {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

// Get busy times from Google Calendar for a date range
async function getBusyTimes(accessToken: string, startDate: string, endDate: string) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: `${startDate}T00:00:00-05:00`,
      timeMax: `${endDate}T23:59:59-05:00`,
      timeZone: "America/Detroit",
      items: [{ id: GOOGLE_CALENDAR_ID }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`FreeBusy error: ${JSON.stringify(data)}`);
  return data.calendars?.[GOOGLE_CALENDAR_ID]?.busy || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
      return new Response(JSON.stringify({ error: "Google Calendar not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { action, booking_id, start_date, end_date } = await req.json();
    const accessToken = await getGoogleAccessToken();

    if (action === "create_event") {
      // Fetch booking and create event
      const { data: booking } = await supabaseAdmin
        .from("session_bookings")
        .select("*")
        .eq("id", booking_id)
        .single();
      if (!booking) throw new Error("Booking not found");

      const eventId = await createCalendarEvent(accessToken, booking);
      
      // Store event ID
      await supabaseAdmin
        .from("session_bookings")
        .update({ google_calendar_event_id: eventId })
        .eq("id", booking_id);

      return new Response(JSON.stringify({ success: true, event_id: eventId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_event") {
      const { data: booking } = await supabaseAdmin
        .from("session_bookings")
        .select("google_calendar_event_id")
        .eq("id", booking_id)
        .single();
      if (booking?.google_calendar_event_id) {
        await deleteCalendarEvent(accessToken, booking.google_calendar_event_id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_busy") {
      if (!start_date || !end_date) throw new Error("start_date and end_date required");
      const busy = await getBusyTimes(accessToken, start_date, end_date);
      return new Response(JSON.stringify({ busy }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync_all") {
      // Sync all confirmed bookings that don't have a Google Calendar event
      const { data: bookings } = await supabaseAdmin
        .from("session_bookings")
        .select("*")
        .eq("status", "confirmed")
        .is("google_calendar_event_id", null);

      let synced = 0;
      for (const booking of (bookings || [])) {
        try {
          const eventId = await createCalendarEvent(accessToken, booking);
          await supabaseAdmin
            .from("session_bookings")
            .update({ google_calendar_event_id: eventId })
            .eq("id", booking.id);
          synced++;
        } catch (e) {
          console.error(`Failed to sync booking ${booking.id}:`, e);
        }
      }

      return new Response(JSON.stringify({ success: true, synced }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    console.error("Google Calendar sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
