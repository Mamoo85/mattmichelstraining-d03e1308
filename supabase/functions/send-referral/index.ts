import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

interface ReferralPayload {
  yourName: string;
  yourEmail: string;
  friendName: string;
  friendBusiness: string;
  friendEmail: string;
  service: string;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Matt Michels <matt@notify.m2training.com>",
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend error ${response.status}: ${err}`);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function friendEmailHtml(p: ReferralPayload): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f1f5f9;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <div style="background:#1e293b;border-radius:8px 8px 0 0;padding:20px 24px;">
      <div style="color:#e8621a;font-size:20px;font-weight:800;">Matt Michels</div>
      <div style="color:#94a3b8;font-size:13px;">M² Performance Training — Metro Detroit</div>
    </div>

    <div style="background:#ffffff;border-radius:0 0 8px 8px;padding:28px 24px;">
      <p style="color:#374151;font-size:15px;margin:0 0 16px;">Hey ${escapeHtml(p.friendName)},</p>

      <p style="color:#374151;font-size:15px;margin:0 0 16px;">
        ${escapeHtml(p.yourName)} mentioned you run ${escapeHtml(p.friendBusiness)} and thought one of my services might save you some time.
      </p>

      <p style="color:#374151;font-size:15px;margin:0 0 16px;">
        I help local businesses automate ${escapeHtml(p.service)} so it runs itself. Your first 7 days are free, no commitment.
      </p>

      <div style="background:#fff7ed;border-left:4px solid #e8621a;padding:16px 20px;border-radius:0 6px 6px 0;margin:24px 0;">
        <div style="font-weight:700;color:#9a3412;margin-bottom:8px;">What's included:</div>
        <ul style="color:#374151;font-size:14px;margin:0;padding-left:20px;line-height:1.8;">
          <li>Done-for-you setup — no tech headaches</li>
          <li>Runs automatically in the background</li>
          <li>7-day free trial, no credit card required to start</li>
          <li>Cancel any time — no contracts</li>
        </ul>
      </div>

      <p style="color:#374151;font-size:15px;margin:0 0 24px;">
        Check out all my services at
        <a href="https://mattmichelstraining.com/all-services" style="color:#e8621a;font-weight:600;">mattmichelstraining.com/all-services</a>
        — or just text me at <strong>(313) 806-4952</strong> and I'll walk you through it.
      </p>

      <p style="color:#374151;font-size:15px;margin:0 0 8px;">— Matt</p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">

      <p style="color:#64748b;font-size:13px;margin:0;">
        P.S. ${escapeHtml(p.yourName)} gets $50 off their next month when you sign up. Mention their name when you reach out.
      </p>
    </div>

    <div style="text-align:center;padding:16px;">
      <div style="color:#94a3b8;font-size:12px;">mattmichelstraining.com &nbsp;|&nbsp; (313) 806-4952 &nbsp;|&nbsp; matt@m2training.com</div>
    </div>
  </div>
</body>
</html>`;
}

function mattEmailHtml(p: ReferralPayload): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f1f5f9;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <div style="background:#1e293b;border-radius:8px 8px 0 0;padding:20px 24px;">
      <div style="color:#e8621a;font-size:20px;font-weight:800;">New Referral Lead</div>
      <div style="color:#94a3b8;font-size:13px;">M² Performance Training</div>
    </div>

    <div style="background:#ffffff;border-radius:0 0 8px 8px;padding:28px 24px;">
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">Matt, someone just sent a referral through your site.</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="background:#f8fafc;">
          <td style="padding:10px 14px;font-weight:600;color:#1e293b;width:140px;border-bottom:1px solid #e5e7eb;">Referred By</td>
          <td style="padding:10px 14px;color:#374151;border-bottom:1px solid #e5e7eb;">${escapeHtml(p.yourName)} — <a href="mailto:${escapeHtml(p.yourEmail)}" style="color:#e8621a;">${escapeHtml(p.yourEmail)}</a></td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#1e293b;border-bottom:1px solid #e5e7eb;">Lead Name</td>
          <td style="padding:10px 14px;color:#374151;border-bottom:1px solid #e5e7eb;">${escapeHtml(p.friendName)}</td>
        </tr>
        <tr style="background:#f8fafc;">
          <td style="padding:10px 14px;font-weight:600;color:#1e293b;border-bottom:1px solid #e5e7eb;">Business</td>
          <td style="padding:10px 14px;color:#374151;border-bottom:1px solid #e5e7eb;">${escapeHtml(p.friendBusiness)}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#1e293b;border-bottom:1px solid #e5e7eb;">Lead Email</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;"><a href="mailto:${escapeHtml(p.friendEmail)}" style="color:#e8621a;">${escapeHtml(p.friendEmail)}</a></td>
        </tr>
        <tr style="background:#f8fafc;">
          <td style="padding:10px 14px;font-weight:600;color:#1e293b;">Service Interest</td>
          <td style="padding:10px 14px;color:#374151;">${escapeHtml(p.service)}</td>
        </tr>
      </table>

      <div style="background:#fff7ed;border-left:4px solid #e8621a;padding:14px 18px;border-radius:0 6px 6px 0;margin-top:24px;">
        <div style="color:#9a3412;font-size:14px;font-weight:600;">Action items:</div>
        <ul style="color:#374151;font-size:14px;margin:8px 0 0;padding-left:20px;line-height:1.8;">
          <li>An intro email has already been sent to ${escapeHtml(p.friendName)} at ${escapeHtml(p.friendEmail)}</li>
          <li>${escapeHtml(p.yourName)} gets a $50 credit when this lead converts — note it in your CRM</li>
          <li>Consider a personal follow-up text to ${escapeHtml(p.friendName)} within 24 hours</li>
        </ul>
      </div>
    </div>

    <div style="text-align:center;padding:16px;">
      <div style="color:#94a3b8;font-size:12px;">Automated referral system — mattmichelstraining.com</div>
    </div>
  </div>
</body>
</html>`;
}

function referrerEmailHtml(p: ReferralPayload): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f1f5f9;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <div style="background:#1e293b;border-radius:8px 8px 0 0;padding:20px 24px;">
      <div style="color:#e8621a;font-size:20px;font-weight:800;">Thanks for the referral!</div>
      <div style="color:#94a3b8;font-size:13px;">M² Performance Training</div>
    </div>

    <div style="background:#ffffff;border-radius:0 0 8px 8px;padding:28px 24px;">
      <p style="color:#374151;font-size:15px;margin:0 0 16px;">Hey ${escapeHtml(p.yourName)},</p>

      <p style="color:#374151;font-size:15px;margin:0 0 16px;">
        Thanks for referring ${escapeHtml(p.friendName)} at ${escapeHtml(p.friendBusiness)}! I just sent them an intro email and let them know you thought of them.
      </p>

      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:18px 20px;margin:20px 0;">
        <div style="color:#166534;font-weight:700;font-size:15px;margin-bottom:8px;">Your $50 credit is waiting</div>
        <p style="color:#374151;font-size:14px;margin:0;">
          When ${escapeHtml(p.friendName)} signs up, you'll get <strong>$50 off your next month</strong> automatically. No need to do anything — I'll apply it to your account when they convert.
        </p>
      </div>

      <p style="color:#374151;font-size:15px;margin:0 0 16px;">
        Know anyone else who could use help automating their business? Send them to
        <a href="https://mattmichelstraining.com/all-services" style="color:#e8621a;font-weight:600;">mattmichelstraining.com/all-services</a>
        — every referral that converts earns you another $50 off.
      </p>

      <p style="color:#374151;font-size:15px;margin:0 0 8px;">Appreciate you, ${escapeHtml(p.yourName)}.</p>
      <p style="color:#374151;font-size:15px;margin:0;">— Matt</p>
    </div>

    <div style="text-align:center;padding:16px;">
      <div style="color:#94a3b8;font-size:12px;">
        mattmichelstraining.com &nbsp;|&nbsp; (313) 806-4952 &nbsp;|&nbsp; matt@m2training.com
      </div>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return corsResponse(JSON.stringify({ ok: false, error: "Method not allowed" }), 405);
  }

  let payload: Partial<ReferralPayload>;

  try {
    payload = await req.json();
  } catch {
    return corsResponse(JSON.stringify({ ok: false, error: "Invalid JSON body" }), 400);
  }

  // Validate required fields
  const required: Array<keyof ReferralPayload> = [
    "yourName",
    "yourEmail",
    "friendName",
    "friendBusiness",
    "friendEmail",
    "service",
  ];

  const missing = required.filter((k) => !payload[k] || String(payload[k]).trim() === "");

  if (missing.length > 0) {
    return corsResponse(
      JSON.stringify({ ok: false, error: `Missing required fields: ${missing.join(", ")}` }),
      400,
    );
  }

  const p = payload as ReferralPayload;

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(p.yourEmail)) {
    return corsResponse(JSON.stringify({ ok: false, error: "Invalid yourEmail address" }), 400);
  }
  if (!emailRegex.test(p.friendEmail)) {
    return corsResponse(JSON.stringify({ ok: false, error: "Invalid friendEmail address" }), 400);
  }

  try {
    // 1. Email the friend
    await sendEmail({
      to: p.friendEmail,
      subject: `${p.yourName} thought you could use this`,
      html: friendEmailHtml(p),
    });

    // 2. Email Matt
    await sendEmail({
      to: "matt@m2training.com",
      subject: `Referral lead: ${p.friendBusiness} from ${p.yourName}`,
      html: mattEmailHtml(p),
    });

    // 3. Email the referrer
    await sendEmail({
      to: p.yourEmail,
      subject: "Thanks for the referral!",
      html: referrerEmailHtml(p),
    });

    return corsResponse(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("send-referral error:", err);
    return corsResponse(
      JSON.stringify({ ok: false, error: String(err) }),
      500,
    );
  }
});
