import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500 });
  }

  const now = new Date().toLocaleString("en-US", { timeZone: "America/Detroit" });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Matt Michels <matt@mattmichelstraining.com>",
      to: ["matt@mattmichelstraining.com"],
      bcc: ["matthewmichels@gmail.com"],
      subject: "\u2705 BCC Test \u2014 M\u00b2 Agent Email System",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#1e293b;color:#e2e8f0;border-radius:12px;">
          <h2 style="color:#e8621a;margin-top:0;">BCC is working &#x2705;</h2>
          <p>This is a test email sent at <strong>${now} ET</strong>.</p>
          <p>If you're seeing this at <strong>matthewmichels@gmail.com</strong>, BCC is confirmed working on all 51 sender functions.</p>
          <p>Every email your AI agents send to leads and clients will now silently copy you.</p>
          <hr style="border-color:#334155;margin:24px 0;">
          <p style="color:#94a3b8;font-size:13px;">&mdash; M&sup2; Automated System<br>matt@mattmichelstraining.com &middot; (313) 806-4952</p>
        </div>
      `,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify({ ok: res.ok, resend: data, sentAt: now }), {
    status: res.ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
});
