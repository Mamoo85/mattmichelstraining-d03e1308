/**
 * email-preferences
 *
 * Public, token-authenticated endpoint for Forever-Pricing clients to manage
 * their value-report email consent. No login required — the unsubscribe
 * token in the URL is the auth.
 *
 * GET  /email-preferences?token=XYZ            → renders an HTML preference page
 * GET  /email-preferences?token=XYZ&action=off → one-click unsubscribe (CAN-SPAM compliant)
 * POST /email-preferences                       → { token, frequency: 'weekly'|'monthly'|'off' }
 *
 * Always responds 200 to avoid leaking which tokens exist.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function htmlPage(opts: { email: string; frequency: string; token: string; message?: string }) {
  const { email, frequency, token, message } = opts;
  const opt = (v: string, label: string, desc: string) => `
    <label style="display:flex;gap:12px;align-items:flex-start;padding:14px;border:1px solid ${frequency === v ? "#00d4ff" : "#1e3a5f"};border-radius:10px;background:${frequency === v ? "#00d4ff14" : "#0a1628"};cursor:pointer;margin-bottom:10px;">
      <input type="radio" name="frequency" value="${v}" ${frequency === v ? "checked" : ""} style="margin-top:3px;accent-color:#00d4ff;">
      <div><div style="color:#fff;font-weight:700;font-size:14px;">${label}</div><div style="color:#94a3b8;font-size:12px;margin-top:2px;">${desc}</div></div>
    </label>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences · Detroit Web Agency</title></head>
<body style="margin:0;background:#030711;font-family:-apple-system,Segoe UI,sans-serif;min-height:100vh;">
  <div style="max-width:560px;margin:0 auto;padding:40px 16px;">
    <div style="background:#0a1628;border:1px solid #00d4ff;border-radius:16px;padding:32px;">
      <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">Email preferences</p>
      <h1 style="color:#fff;font-size:22px;margin:0 0 6px;">${email}</h1>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 24px;">Forever-Pricing weekly value report</p>
      ${message ? `<div style="background:#16a34a22;border:1px solid #22c55e;color:#86efac;padding:12px;border-radius:8px;margin-bottom:20px;font-size:13px;">${message}</div>` : ""}
      <form method="POST" action="/functions/v1/email-preferences">
        <input type="hidden" name="token" value="${token}">
        ${opt("weekly", "Weekly (recommended)", "Every Monday morning. See what shipped + new tools added.")}
        ${opt("monthly", "Monthly digest", "First of each month. Bigger highlights only.")}
        ${opt("off", "Unsubscribe", "Stop value reports. Your subscription and locked rate are unaffected.")}
        <button type="submit" style="width:100%;background:#00d4ff;color:#0a1628;border:none;padding:14px;border-radius:8px;font-weight:800;font-size:14px;cursor:pointer;margin-top:8px;">Save preferences</button>
      </form>
      <p style="color:#475569;font-size:11px;margin:24px 0 0;border-top:1px solid #1e3a5f;padding-top:16px;text-align:center;">
        Detroit Web Agency · matt@detroitwebagent.com · (313) 992-1219
      </p>
    </div>
  </div>
</body></html>`;
}

function notFoundPage() {
  return `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:sans-serif;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:20px;">
  <div><h1 style="color:#00d4ff;">Link expired</h1><p style="color:#94a3b8;">This preferences link is no longer valid. Reply STOP to any email to unsubscribe, or email matt@detroitwebagent.com.</p></div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let token: string | null = null;
    let frequency: string | null = null;

    if (req.method === "GET") {
      token = url.searchParams.get("token");
      frequency = url.searchParams.get("action"); // optional one-click
    } else if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await req.json();
        token = body.token;
        frequency = body.frequency;
      } else {
        const form = await req.formData();
        token = String(form.get("token") || "");
        frequency = String(form.get("frequency") || "");
      }
    }

    if (!token) {
      return new Response(notFoundPage(), { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } });
    }

    const { data: pref, error } = await sb
      .from("client_email_preferences")
      .select("id, client_email, frequency, unsubscribe_token")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (error || !pref) {
      return new Response(notFoundPage(), { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } });
    }

    let savedMessage: string | undefined;

    if (frequency && ["weekly", "monthly", "off"].includes(frequency)) {
      const update: Record<string, any> = { frequency };
      if (frequency === "off") update.unsubscribed_at = new Date().toISOString();
      else update.unsubscribed_at = null;
      const { error: upErr } = await sb
        .from("client_email_preferences")
        .update(update)
        .eq("id", pref.id);
      if (upErr) {
        return new Response(JSON.stringify({ ok: false, error: upErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pref.frequency = frequency;
      savedMessage =
        frequency === "off"
          ? "Unsubscribed. You will no longer receive value reports. Your subscription is unaffected."
          : `Saved. You will receive ${frequency} reports.`;

      // For JSON POST, return JSON
      if (req.method === "POST" && (req.headers.get("content-type") || "").includes("application/json")) {
        return new Response(JSON.stringify({ ok: true, frequency, message: savedMessage }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      htmlPage({ email: pref.client_email, frequency: pref.frequency, token, message: savedMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } },
    );
  } catch (e: any) {
    console.error("[email-preferences] FATAL", e);
    return new Response(notFoundPage(), { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } });
  }
});
