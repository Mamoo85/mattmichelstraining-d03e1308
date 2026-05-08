// DJ Conley demo contact form -> emails Pat (pmichels@djconley.com)
import { corsHeaders } from "@supabase/supabase-js/cors";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TO_EMAIL = "pmichels@djconley.com";
const CC_EMAIL = "matt@detroitwebagent.com";
const FROM_EMAIL = "D.J. Conley Website <notify@detroitwebagent.com>";

function escape(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim().slice(0, 120);
    const company = String(body.company ?? "").trim().slice(0, 160);
    const email = String(body.email ?? "").trim().slice(0, 200);
    const topic = String(body.topic ?? "General Information").trim().slice(0, 60);
    const message = String(body.message ?? "").trim().slice(0, 5000);
    const honeypot = String(body.website ?? "").trim();

    // Validation
    if (honeypot) {
      // bot - silently succeed
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "missing_required_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "invalid_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "email_not_configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
<div style="font-family:system-ui,Arial,sans-serif;max-width:600px;margin:0 auto;color:#222">
  <div style="background:#e30613;color:#fff;padding:20px 24px;font-weight:bold;font-size:18px">
    New Contact Form Submission — D.J. Conley Associates, Inc.
  </div>
  <div style="padding:24px;border:1px solid #eee;border-top:none">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#888;width:140px">Name</td><td style="padding:6px 0"><strong>${escape(name)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#888">Company</td><td style="padding:6px 0">${escape(company) || "<em>—</em>"}</td></tr>
      <tr><td style="padding:6px 0;color:#888">Email</td><td style="padding:6px 0"><a href="mailto:${escape(email)}">${escape(email)}</a></td></tr>
      <tr><td style="padding:6px 0;color:#888">Topic</td><td style="padding:6px 0">${escape(topic)}</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #eee;margin:18px 0" />
    <div style="color:#888;font-size:13px;margin-bottom:6px">Message</div>
    <div style="white-space:pre-wrap;font-size:15px;line-height:1.6">${escape(message)}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:18px 0" />
    <div style="color:#aaa;font-size:12px">Sent from djconley.com contact form · ${new Date().toLocaleString("en-US", { timeZone: "America/Detroit" })} ET</div>
  </div>
</div>`.trim();

    const text = `New contact form submission — D.J. Conley\n\nName: ${name}\nCompany: ${company || "—"}\nEmail: ${email}\nTopic: ${topic}\n\nMessage:\n${message}\n`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        cc: [CC_EMAIL],
        reply_to: email,
        subject: `[D.J. Conley] ${topic} — ${name}${company ? " (" + company + ")" : ""}`,
        html,
        text,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Resend error:", resp.status, err);
      return new Response(JSON.stringify({ error: "send_failed", detail: err }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("contact error:", e);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
