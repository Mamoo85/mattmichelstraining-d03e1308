import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { dwaEmail } from "../_shared/dwa-email.ts";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const Body = z.object({
  prospect_email: z.string().trim().email().max(255),
  prospect_name: z.string().trim().min(1).max(120),
  company: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(255).optional(),
  slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot_time: z.string().regex(/^\d{2}:\d{2}$/),
  demo_type: z.enum(["discovery_15", "full_30"]).default("discovery_15"),
  notes: z.string().max(2000).optional(),
  source: z.string().max(80).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const b = parsed.data;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = crypto.randomUUID();
    const { data: booking, error } = await sb.from("demo_bookings").insert({
      prospect_email: b.prospect_email.toLowerCase(),
      prospect_name: b.prospect_name,
      company: b.company ?? null,
      phone: b.phone ?? null,
      website: b.website ?? null,
      slot_date: b.slot_date,
      slot_time: b.slot_time,
      demo_type: b.demo_type,
      notes: b.notes ?? null,
      source: b.source ?? "book-demo-page",
      prospect_token: token,
    }).select("id").single();
    if (error) throw error;

    const lengthLabel = b.demo_type === "full_30" ? "30-min full demo" : "15-min discovery call";
    const dateNice = new Date(`${b.slot_date}T${b.slot_time}:00-04:00`).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });

    // SMS Matt
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_FROM,
      `📅 NEW DEMO BOOKED\n${b.prospect_name}${b.company ? ` (${b.company})` : ""}\n${dateNice} ET — ${lengthLabel}\n${b.prospect_email}${b.phone ? ` · ${b.phone}` : ""}`,
      "demo_booking",
    ).catch(() => {});

    // Confirmation email to prospect
    await dwaEmail({
      to: b.prospect_email,
      subject: `Confirmed: your demo with Detroit Web Agency — ${dateNice} ET`,
      html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;color:#0a1628">
        <h2 style="color:#0a1628;margin:0 0 8px">You're booked, ${b.prospect_name.split(" ")[0]} 🎯</h2>
        <p>Looking forward to walking you through what we'd build for ${b.company || "your business"}.</p>
        <div style="background:#0a1628;color:#fff;padding:18px 22px;border-radius:10px;margin:18px 0">
          <div style="color:#00d4ff;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:700">Confirmed</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px">${dateNice} ET</div>
          <div style="color:#94a3b8;font-size:14px">${lengthLabel} · video call</div>
        </div>
        <p>I'll send a calendar invite + the meeting link a few hours before. If anything changes, reply to this email or text/call me at <strong>(313) 992-1219</strong>.</p>
        <p style="margin-top:24px">— Matt Michels<br/>Detroit Web Agency<br/><a href="https://detroitwebagent.com" style="color:#0a8a9c">detroitwebagent.com</a></p>
      </div>`,
    }).catch(() => {});

    return new Response(JSON.stringify({ ok: true, booking_id: booking.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
