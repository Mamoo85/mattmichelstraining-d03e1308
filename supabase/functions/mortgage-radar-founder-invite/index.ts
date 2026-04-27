// Mortgage Radar — Founder Seat Invite
// Admin-only. Provisions a free founder seat (is_founder=true, no Stripe), then
// emails the recipient a signed dashboard portal link (same HMAC scheme as the weekly digest).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encode } from "https://deno.land/std@0.190.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const HMAC_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD_ORIGIN = Deno.env.get("DASHBOARD_ORIGIN") || "https://detroitwebagent.com";

async function signDashboardToken(email: string): Promise<string> {
  // 30-day expiry for founder seats (vs 7 days for digest links)
  const payload = JSON.stringify({ email, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  const tokenB64 = encode(new TextEncoder().encode(payload));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(tokenB64));
  return `${tokenB64}.${encode(new Uint8Array(sig))}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // ── Admin auth required ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userError } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Auth failed" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleCheck } = await sb.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate input ──
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const contact_name = body.contact_name ? String(body.contact_name).trim() : null;
    const business_name = body.business_name ? String(body.business_name).trim() : null;
    const nmls_number = body.nmls_number ? String(body.nmls_number).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const zipsRaw = Array.isArray(body.zip_codes) ? body.zip_codes : [];
    const zip_codes = zipsRaw
      .map((z: unknown) => String(z).trim())
      .filter((z: string) => /^\d{5}$/.test(z));

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (zip_codes.length === 0 || zip_codes.length > 10) {
      return new Response(JSON.stringify({ error: "Provide 1–10 valid 5-digit ZIP codes" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Upsert founder client ──
    // manual_ack_at + tcpa_consent_at set to now() — admin acknowledges FCRA on behalf of the founder.
    const now = new Date().toISOString();
    const { data: upserted, error: upsertErr } = await (sb.from as any)("mortgage_radar_clients")
      .upsert({
        email,
        contact_name,
        business_name,
        nmls_number,
        phone,
        zip_codes,
        is_founder: true,
        active: true,
        manual_ack_at: now,
        tcpa_consent_at: now,
        // No stripe_customer_id / stripe_subscription_id — explicit zero-Stripe seat
      }, { onConflict: "email" })
      .select("id, email, zip_codes, is_founder")
      .single();

    if (upsertErr) {
      console.error("[founder-invite] upsert error:", upsertErr);
      return new Response(JSON.stringify({ error: `DB error: ${upsertErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Sign dashboard portal link ──
    const dashboardToken = await signDashboardToken(email);
    const dashboardUrl = `${DASHBOARD_ORIGIN}/my-mortgage-radar?email=${encodeURIComponent(email)}&token=${encodeURIComponent(dashboardToken)}`;

    // ── Send invite email (best-effort; do NOT fail the call if email errors) ──
    let emailSent = false;
    let emailError: string | null = null;
    if (RESEND_API_KEY) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: [email],
            subject: "🏠 You're in — your Mortgage Radar founder seat is live",
            html: `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;">
              <div style="max-width:620px;margin:0 auto;padding:28px;">
                <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin:0;">🏠 Mortgage Radar — Founder Seat</p>
                <h1 style="color:#fff;font-size:24px;margin:10px 0 14px;">Hey${contact_name ? " " + contact_name.split(" ")[0] : ""} — you're in.</h1>
                <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 14px;">
                  Your founder seat is live. Free, forever — no credit card, no Stripe, no trial timer.
                </p>
                <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 18px;">
                  Mortgage Radar scans Metro Detroit public records (renovation permits, FSBOs, foreclosure notices,
                  estate sales, new LLCs) for in-market borrowers in your ZIPs and surfaces them daily.
                  100% FCRA-clean — no trigger leads, no credit-bureau data. Compliant with H.R. 2808.
                </p>
                <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;padding:16px;margin:0 0 20px;">
                  <p style="color:#94a3b8;font-size:12px;margin:0 0 6px;">Watching these ZIPs:</p>
                  <p style="color:#00d4ff;font-size:14px;font-weight:700;margin:0;font-family:monospace;">${zip_codes.join(" · ")}</p>
                </div>
                <div style="text-align:center;margin:24px 0;">
                  <a href="${dashboardUrl}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:800;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">Open Your Dashboard →</a>
                </div>
                <p style="color:#64748b;font-size:12px;line-height:1.6;margin:18px 0 0;">
                  This link is valid for 30 days. Bookmark the dashboard once you're in — your weekly digest will refresh it automatically.
                </p>
                <p style="color:#64748b;font-size:11px;line-height:1.6;margin:14px 0 0;border-top:1px solid #1e3a5f;padding-top:14px;">
                  All outreach must be sent manually by you, in compliance with TCPA + FCRA.
                  Mortgage Radar uses public + behavioral signals only — we do not access, purchase,
                  or resell credit-bureau trigger leads.
                </p>
              </div></body></html>`,
          }),
        });
        if (!r.ok) {
          emailError = `Resend ${r.status}: ${await r.text()}`;
          console.error("[founder-invite]", emailError);
        } else {
          emailSent = true;
        }
      } catch (e) {
        emailError = e instanceof Error ? e.message : String(e);
        console.error("[founder-invite] email send threw:", emailError);
      }
    } else {
      emailError = "RESEND_API_KEY not configured";
    }

    return new Response(JSON.stringify({
      success: true,
      client_id: upserted.id,
      email,
      zip_codes,
      is_founder: true,
      dashboard_url: dashboardUrl,
      email_sent: emailSent,
      email_error: emailError,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[founder-invite] fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
