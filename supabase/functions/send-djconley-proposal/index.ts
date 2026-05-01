// Edge function: send-djconley-proposal
// One-shot: emails Pat at D.J. Conley the post-meeting proposal.
// DWA brand wrapper, $499/mo + $499+$199/mo options, Forever Pricing promise, fusion example, both demo links.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function dwaShell(bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#0a1628">
  <div style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid #00d4ff">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:#00d4ff">WEB AGENCY</span></div>
    <div style="color:#00d4ff;font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">WE HANDLE THE TECH</div>
  </div>
  <div style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.7">${bodyHtml}</div>
  <div style="padding:20px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#4a6fa5;font-size:12px">Detroit Web Agency · Grosse Pointe Park, MI · (313) 992-1219</p>
    <p style="margin:6px 0 0;font-size:11px"><a href="https://detroitwebagent.com" style="color:#00d4ff;text-decoration:none">detroitwebagent.com</a></p>
  </div>
</div></body></html>`;
}

function buildBody(firstName: string): string {
  const name = firstName || "Pat";
  return `
    <p style="font-size:22px;font-weight:800;color:#ffffff;margin:0 0 6px;line-height:1.25">Great meeting yesterday, ${name}.</p>
    <p style="color:#94a3b8;margin:0 0 24px">Here's exactly what I'd build for D.J. Conley — laid out in plain English, with two ways to pay.</p>

    <div style="background:#0d1f3c;border-left:3px solid #00d4ff;padding:18px 22px;border-radius:0 8px 8px 0;margin:0 0 24px">
      <p style="color:#ffffff;font-weight:700;font-size:14px;margin:0 0 10px;letter-spacing:0.5px">THE OFFER — DWA MANAGED WEBSITE + OWNER DASHBOARD</p>
      <p style="margin:0 0 10px;color:#e2e8f0;font-size:14px"><strong style="color:#00d4ff">Option A — All-in monthly:</strong> $499/mo. Zero upfront. Cancel anytime.</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px"><strong style="color:#00d4ff">Option B — Build + Maintain:</strong> $499 one-time + $199/mo. Lower recurring.</p>
    </div>

    <div style="background:linear-gradient(135deg,#0d1f3c 0%,#13294b 100%);border:2px solid #00d4ff;border-radius:12px;padding:22px 24px;margin:0 0 24px;text-align:center">
      <p style="color:#00d4ff;font-weight:900;font-size:11px;margin:0 0 8px;letter-spacing:2px;text-transform:uppercase">⚡ FOREVER PRICING PROMISE</p>
      <p style="color:#ffffff;font-size:15px;font-weight:600;margin:0;line-height:1.55">Your price never goes up. Every upgrade we ship — forever — is included free. We push improvements every single day. You're not buying a snapshot, you're buying the cutting edge for life.</p>
    </div>

    <p style="color:#ffffff;font-weight:700;font-size:14px;margin:0 0 12px;letter-spacing:0.5px">WHAT'S INCLUDED (every option, both prices):</p>
    <ul style="margin:0 0 24px;padding:0 0 0 20px;color:#e2e8f0;font-size:14px;line-height:1.9">
      <li><strong style="color:#00d4ff">Brand-new website</strong> — your colors, your branding, fast, mobile-perfect</li>
      <li><strong style="color:#00d4ff">Owner Dashboard</strong> — log into <em>your own site at /admin</em> and edit hero text, photos, services yourself. No calling us.</li>
      <li><strong style="color:#00d4ff">SiteRadar Pro</strong> — instant SMS the moment a real company hits your site. We identify the company instantly, then surface the most likely decision-maker for you to call.</li>
      <li><strong style="color:#00d4ff">Predictive Sales fusion alerts</strong> — see fusion example below</li>
      <li><strong style="color:#00d4ff">Missed-call text-back + automated review requests</strong> — every missed call gets a text in &lt; 60 seconds; review request sent to every customer after every job</li>
      <li><strong style="color:#00d4ff">Email Blast Engine</strong> — controlled from your dashboard. Manual blasts, auto-recurring seasonal reminders, or trigger-based (e.g., "email everyone 6 months after their last service"). Master on/off toggle.</li>
    </ul>

    <div style="background:#0d1f3c;border:1px solid #00d4ff40;border-radius:12px;padding:20px 22px;margin:0 0 28px">
      <p style="color:#00d4ff;font-weight:800;font-size:12px;margin:0 0 10px;letter-spacing:1.5px;text-transform:uppercase">🎯 The Fusion Example (this is the wedge)</p>
      <p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.6">When <strong>Stellantis visits your boiler tune-up page</strong> AND has an active <strong>$2.4M RFP on MITN.info</strong> the same week, you get <strong>one SMS</strong> with both signals tied together. That's it — one message. No competitor offers this. No CRM, no marketing tool, nobody. It's the reason this product exists.</p>
    </div>

    <div style="background:#0d1f3c;border-left:3px solid #E07B39;padding:18px 22px;border-radius:0 8px 8px 0;margin:0 0 24px">
      <p style="color:#ffffff;font-weight:700;font-size:14px;margin:0 0 10px;letter-spacing:0.5px">ZERO eWAY DISRUPTION</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6">eWay keeps doing what it does — dispatch, scheduling, contacts. We're the marketing + intelligence layer that sits on top. Nobody on your team has to learn anything new or change a single workflow.</p>
    </div>

    <div style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:12px;padding:20px 22px;margin:0 0 28px">
      <p style="color:#ffffff;font-weight:700;font-size:14px;margin:0 0 14px;letter-spacing:0.5px">DEMO LINKS (rebuilt in your colors — navy + orange)</p>
      <p style="margin:0 0 8px"><a href="https://detroitwebagent.com/demo-djconley-v2/index.html" style="color:#00d4ff;text-decoration:none;font-weight:600">→ Demo A — D.J. Conley homepage concept</a></p>
      <p style="margin:0"><a href="https://detroitwebagent.com/demo-djconley-v3/index.html" style="color:#00d4ff;text-decoration:none;font-weight:600">→ Demo B — alternate layout</a></p>
      <p style="color:#94a3b8;font-size:12px;margin:12px 0 0">Tell me which direction feels right and I'll polish that one for the real site.</p>
    </div>

    <div style="background:linear-gradient(135deg,#00d4ff 0%,#0099cc 100%);border-radius:12px;padding:24px;margin:0 0 24px;text-align:center">
      <p style="color:#0a1628;font-weight:900;font-size:18px;margin:0 0 10px;line-height:1.3">Ready to lock in today's price forever?</p>
      <p style="color:#0a1628;font-size:14px;margin:0 0 16px;font-weight:600;line-height:1.5">Just reply <strong>"YES"</strong> and tell me which option (A or B). I'll send the setup form tonight and a Stripe link in the morning.</p>
      <p style="color:#0a1628;font-size:13px;margin:0;font-weight:600">Or call/text me direct: <strong>(313) 992-1219</strong></p>
    </div>

    <div style="border-top:1px solid #1e3a5f;padding-top:20px">
      <p style="color:#e2e8f0;font-size:14px;margin:0">— Matt Michels</p>
      <p style="color:#4a6fa5;font-size:12px;margin:5px 0 0">Detroit Web Agency &nbsp;·&nbsp; (313) 992-1219 &nbsp;·&nbsp; <a href="mailto:matt@detroitwebagent.com" style="color:#00d4ff;text-decoration:none">matt@detroitwebagent.com</a></p>
      <p style="color:#4a6fa5;font-size:11px;margin:18px 0 0;font-style:italic">P.S. The Forever Pricing promise isn't marketing copy — it's contractually locked. Whatever number you sign at, you stay at. New features ship daily and you get them all, free, for as long as you're a customer. That's the whole deal.</p>
    </div>`;
}

function buildPlainText(firstName: string): string {
  const name = firstName || "Pat";
  return `Great meeting yesterday, ${name}.

Here's exactly what I'd build for D.J. Conley — two ways to pay:

  Option A — All-in monthly: $499/mo. Zero upfront. Cancel anytime.
  Option B — Build + Maintain: $499 one-time + $199/mo.

⚡ FOREVER PRICING PROMISE
Your price never goes up. Every upgrade we ship — forever — is included free. We push improvements every single day. You're not buying a snapshot, you're buying the cutting edge for life.

What's included (both prices):
  • Brand-new website — your colors, your branding, fast, mobile-perfect
  • Owner Dashboard — log into your own site at /admin and edit hero text, photos, services yourself
  • SiteRadar Pro — instant SMS the moment a real company hits your site. We identify the company instantly, then surface the most likely decision-maker for you to call.
  • Predictive Sales fusion alerts (see below)
  • Missed-call text-back (< 60s) + automated review requests after every job
  • Email Blast Engine — controlled from your dashboard. Manual, auto-recurring seasonal, or trigger-based. Master on/off.

🎯 THE FUSION EXAMPLE
When Stellantis visits your boiler tune-up page AND has an active $2.4M RFP on MITN.info the same week, you get ONE SMS with both signals tied together. No competitor offers this.

ZERO eWAY DISRUPTION
eWay keeps doing what it does. We're the marketing + intelligence layer on top. Nobody learns anything new.

DEMO LINKS (rebuilt in your navy + orange):
  → Demo A: https://detroitwebagent.com/demo-djconley-v2/index.html
  → Demo B: https://detroitwebagent.com/demo-djconley-v3/index.html

Ready to lock today's price forever?
Just reply "YES" and tell me which option (A or B). I'll send the setup form tonight and a Stripe link in the morning.

Or call/text me direct: (313) 992-1219

— Matt Michels
Detroit Web Agency · (313) 992-1219 · matt@detroitwebagent.com

P.S. The Forever Pricing promise isn't marketing copy — it's contractually locked. Whatever number you sign at, you stay at. New features ship daily and you get them all, free, for as long as you're a customer.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const recipientEmail: string = String(body.recipient_email || "").trim().toLowerCase();
    const firstName: string = String(body.first_name || "Pat").trim();

    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: "Valid recipient_email required" }), { status: 400, headers: CORS });
    }

    const html = dwaShell(buildBody(firstName));
    const text = buildPlainText(firstName);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>",
        to: [recipientEmail],
        bcc: ["matthewmichels4@gmail.com"],
        reply_to: "matt@detroitwebagent.com",
        subject: "D.J. Conley + Detroit Web Agency — exactly what I'd build",
        html,
        text,
      }),
    });

    const resendBody = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      console.error("[send-djconley-proposal] Resend error", resendBody);
      return new Response(JSON.stringify({ error: "Resend send failed", detail: resendBody }), { status: 502, headers: CORS });
    }

    // Audit log to notifications
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await sb.from("notifications" as any).insert({
      type: "outreach_proposal",
      title: `DJ Conley proposal sent → ${recipientEmail}`,
      body: `Post-meeting proposal email delivered. Resend id: ${resendBody?.id || "?"}`,
      link: "/dwa-admin",
      urgency: "fyi",
      category: "outreach",
    }).catch(() => {});

    return new Response(JSON.stringify({ sent: true, resend_id: resendBody?.id, to: recipientEmail }), { headers: CORS });
  } catch (err) {
    console.error("[send-djconley-proposal] Error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
