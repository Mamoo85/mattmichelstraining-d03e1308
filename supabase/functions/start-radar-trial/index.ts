// start-radar-trial — Universal 7-day no-CC trial for any DWA radar product.
// Accepts { email, product, business_name?, phone?, city?, state?, zip_codes?, source? }
// Creates a row in radar_trials with a magic token, sends a DWA-branded email
// with a one-click magic-link login URL into /my-<product>?trial=<token>.
// Founders are auto-marked status='founder' and never expire.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dwaEmail, dwaWrap } from "../_shared/dwa-email.ts";
import { isFounder } from "../_shared/founder-seats.ts";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://detroitwebagent.com";

const PRODUCT_CONFIG: Record<string, { label: string; dashboardPath: string; pitch: string }> = {
  mortgage_radar: {
    label: "Mortgage Radar",
    dashboardPath: "/my-mortgage-radar",
    pitch: "in-market homeowner leads — FSBO, divorce, probate, equity-rich",
  },
  techalert: {
    label: "TechAlert",
    dashboardPath: "/talent-radar/dashboard",
    pitch: "live signals when local trades businesses raise, hire, or post permits",
  },
  site_radar: {
    label: "SiteRadar",
    dashboardPath: "/my-site-radar",
    pitch: "company-level identification of who visits your website",
  },
  contractor_leads: {
    label: "Contractor Leads",
    dashboardPath: "/my-contractor-leads",
    pitch: "exclusive Michigan homeowner leads — first reply free",
  },
  missed_call: {
    label: "Missed-Call Catch",
    dashboardPath: "/missed-call-catch",
    pitch: "auto-text + voicemail capture every time you miss a call",
  },
  industry_pulse: {
    label: "Growth Radar",
    dashboardPath: "/my-industry-pulse",
    pitch: "industry-wide demand signals scored daily",
  },
  fielddesk: {
    label: "FieldDesk",
    dashboardPath: "/field-service/dispatch",
    pitch: "dispatch, GPS, and invoicing for your field crews",
  },
  bundle_revenue_suite: {
    label: "Bundle Revenue Suite",
    dashboardPath: "/bundle-revenue-suite",
    pitch: "all five revenue tools at one bundled price",
  },
  roofing_radar: {
    label: "Roofing Radar",
    dashboardPath: "/my-roofing-radar",
    pitch: "homeowners hit by hail or roof permits pulled in your ZIPs — before they call anyone",
  },
  hvac_radar: {
    label: "HVAC Radar",
    dashboardPath: "/my-hvac-radar",
    pitch: "homes needing HVAC replacement flagged by extreme weather + aging system permits",
  },
  plumbing_radar: {
    label: "Plumbing Radar",
    dashboardPath: "/my-plumbing-radar",
    pitch: "foreclosures and major plumbing permits signaling deferred maintenance in your ZIPs",
  },
  electrical_radar: {
    label: "Electrical Radar",
    dashboardPath: "/my-electrical-radar",
    pitch: "renovation and addition permits triggering panel upgrades in your service area",
  },
  pest_control_radar: {
    label: "Pest Control Radar",
    dashboardPath: "/my-pest-control-radar",
    pitch: "vacant estate sales, probates, and foreclosures — the highest-risk pest properties",
  },
  gutters_radar: {
    label: "Gutters Radar",
    dashboardPath: "/my-gutters-radar",
    pitch: "roof permits pulled = open gutter upsell window in your ZIPs",
  },
  painting_radar: {
    label: "Painting Radar",
    dashboardPath: "/my-painting-radar",
    pitch: "new ownership deed transfers and FSBO prep listings in your service area",
  },
};

function genToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isValidEmail(s: string): boolean {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const product = String(body.product || "").trim();

  if (!isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "invalid_email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const cfg = PRODUCT_CONFIG[product];
  if (!cfg) {
    return new Response(JSON.stringify({ error: "unknown_product", product }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const founder = isFounder(email);
  const token = genToken();
  const status = founder ? "founder" : "active";
  // Founders effectively never expire — push out 100 years.
  const expiresAt = founder
    ? new Date(Date.now() + 100 * 365 * 86400_000).toISOString()
    : new Date(Date.now() + 7 * 86400_000).toISOString();

  // Idempotent: if there's already a non-expired trial for this email+product,
  // re-issue the magic link rather than create a duplicate row.
  const { data: existing } = await sb
    .from("radar_trials")
    .select("id, magic_token, status, expires_at")
    .eq("email", email)
    .eq("product", product)
    .maybeSingle();

  let magicToken = token;
  if (existing) {
    if (existing.status === "active" || existing.status === "founder") {
      magicToken = existing.magic_token;
    } else {
      // expired/revoked → start fresh
      const { error: upErr } = await sb
        .from("radar_trials")
        .update({
          magic_token: token,
          status,
          expires_at: expiresAt,
          source: body.source || null,
          ip_address: req.headers.get("x-forwarded-for") || null,
          user_agent: req.headers.get("user-agent") || null,
          business_name: body.business_name || null,
          phone: body.phone || null,
          city: body.city || null,
          state: body.state || "MI",
          zip_codes: Array.isArray(body.zip_codes) ? body.zip_codes : null,
          metadata: body.metadata || {},
          trial_started_at: new Date().toISOString(),
          converted_at: null,
        })
        .eq("id", existing.id);
      if (upErr) {
        console.error("[start-radar-trial] update error", upErr);
        return new Response(JSON.stringify({ error: "db_update_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  } else {
    const { error: insErr } = await sb.from("radar_trials").insert({
      email,
      product,
      magic_token: token,
      status,
      expires_at: expiresAt,
      source: body.source || null,
      ip_address: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
      business_name: body.business_name || null,
      phone: body.phone || null,
      city: body.city || null,
      state: body.state || "MI",
      zip_codes: Array.isArray(body.zip_codes) ? body.zip_codes : null,
      metadata: body.metadata || {},
    });
    if (insErr) {
      console.error("[start-radar-trial] insert error", insErr);
      return new Response(JSON.stringify({ error: "db_insert_failed", detail: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const magicUrl = `${SITE_URL}${cfg.dashboardPath}?trial=${magicToken}`;
  const inner = `
    <h1 style="color:#00d4ff;font-size:24px;margin:0 0 16px;">Your ${cfg.label} trial is live</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
      You now have <strong>7 days of full access</strong> to ${cfg.label} — ${cfg.pitch}. No credit card required.
    </p>
    <p style="margin:0 0 14px;font-size:14px;color:#a8b8d0;line-height:1.6;">
      Click the button below to log in instantly — no password to remember. The link is unique to your email and works on any device.
    </p>
    ${founder ? `<p style="margin:0 0 14px;font-size:13px;color:#00d4ff;background:#0a1628;padding:10px 14px;border-left:3px solid #00d4ff;">Founder seat — your access never expires.</p>` : ""}
  `;

  const html = dwaWrap(inner, { ctaText: `Open my ${cfg.label} dashboard →`, ctaUrl: magicUrl });

  const sendRes = await dwaEmail({
    to: email,
    subject: `🎯 Your ${cfg.label} trial is live — log in instantly`,
    html,
  });

  if (!sendRes.ok) {
    console.error("[start-radar-trial] email send failed", sendRes.error);
    // Don't fail the request — the trial is created. The customer can re-request.
  }

  // 🔔 Ping Matt — every trial signup (fire-and-forget, never blocks).
  sendSMS(
    ADMIN_PHONE,
    TWILIO_FROM,
    `🎯 NEW TRIAL — ${cfg.label}\n${email}${body.business_name ? `\n${body.business_name}` : ""}${body.phone ? `\n${body.phone}` : ""}${founder ? "\n(founder seat)" : ""}\nsrc: ${body.source || "direct"}`,
    "trial_signup_alert",
    false,
    { bypassQuietHours: true },
  ).catch((e) => console.error("[start-radar-trial] admin SMS failed", e));

  return new Response(
    JSON.stringify({
      ok: true,
      trial: { email, product, expires_at: expiresAt, status },
      magic_url: magicUrl,
      email_sent: sendRes.ok,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
