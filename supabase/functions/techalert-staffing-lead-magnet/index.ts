// techalert-staffing-lead-magnet — POST { email, agency, county? }
// Captures lead, pulls 10 highest-availability nursing candidates from hire_alert_candidates,
// emails a branded HTML "10 Free Names" report. Stripe-style soft CTA at the bottom.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NURSING_TRADES = ["nursing", "home_health", "cna", "rn", "lpn"];

function maskName(full: string): string {
  // First name + last initial only, so they have to subscribe to get full data
  const parts = (full || "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "—";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { email, agency, county, phone } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "valid email required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 1. Capture lead (best-effort — table may not exist on every env)
    await sb.from("techalert_staffing_leads").upsert({
      email,
      agency: agency || null,
      county: county || null,
      phone: phone || null,
      source: "free_10_names",
      created_at: new Date().toISOString(),
    }, { onConflict: "email" }).then(r => {
      if (r.error) console.warn("[lead-magnet] upsert warn:", r.error.message);
    });

    // 2. Pull top 10 nursing candidates
    let q = sb.from("hire_alert_candidates")
      .select("full_name,name,trade,license_type,city,county,zip,license_expiry,availability_score,first_seen_at")
      .in("trade", NURSING_TRADES)
      .order("availability_score", { ascending: false, nullsFirst: false })
      .order("first_seen_at", { ascending: false })
      .limit(10);
    if (county) q = q.ilike("county", `%${county}%`);
    const { data: candidates, error: cErr } = await q;
    if (cErr) console.warn("[lead-magnet] candidate query warn:", cErr.message);

    const rows = (candidates || []).map((c, i) => {
      const fullName = c.full_name || c.name || "Candidate";
      const role = (c.license_type || c.trade || "Healthcare").toUpperCase();
      const where = [c.city, c.zip].filter(Boolean).join(", ") || "Michigan";
      const score = c.availability_score ?? "—";
      const seen = c.first_seen_at ? new Date(c.first_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px;">${i + 1}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #1e293b;color:#fff;font-weight:600;font-size:14px;">${maskName(fullName)}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #1e293b;color:#00d4ff;font-size:13px;font-weight:600;">${role}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #1e293b;color:#cbd5e1;font-size:13px;">${where}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #1e293b;color:#fff;font-size:13px;text-align:center;">${score}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:12px;">${seen}</td>
        </tr>`;
    }).join("");

    const tableHtml = rows.length
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0;background:#0d1b2e;border:1px solid #1e293b;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#0a1628;">
              <th style="padding:12px 14px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">#</th>
              <th style="padding:12px 14px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Candidate</th>
              <th style="padding:12px 14px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">License</th>
              <th style="padding:12px 14px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Where</th>
              <th style="padding:12px 14px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Score</th>
              <th style="padding:12px 14px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Seen</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`
      : `<div style="background:#0d1b2e;border:1px dashed #1e293b;border-radius:8px;padding:24px;margin:20px 0;color:#cbd5e1;font-size:14px;">
          Our scanner is pulling fresh LARA records for ${county || "your county"} right now. You'll get your first batch within 24 hours — we email you the moment new licenses clear.
        </div>`;

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">

  <tr><td style="background:#0d1b2e;border:1px solid #1e293b;padding:24px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">TechAlert · Healthcare Staffing</p>
    <p style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:800;">Your 10 Free Candidates${county ? ` · ${county}` : ""}</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${agency ? `For ${agency} · ` : ""}Pulled live from Michigan LARA license records.</p>
  </td></tr>

  <tr><td style="background:#0d1b2e;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:24px 28px;">
    <p style="color:#cbd5e1;font-size:15px;line-height:1.7;margin:0 0 8px;">
      These are real CNA, LPN, and RN candidates whose licenses recently cleared in Michigan. We track every license issuance the moment it hits the state board — most agencies don't see these names for 3–6 weeks.
    </p>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
      Names below are partially masked (first name + last initial). <strong style="color:#00d4ff;">Subscribers see full names, license numbers, phone, email, and license-expiry alerts daily at 7am.</strong>
    </p>

    ${tableHtml}

    <div style="background:#0a1628;border:1px solid #00d4ff;border-radius:8px;padding:20px 24px;margin:24px 0 16px;text-align:center;">
      <p style="margin:0 0 6px;color:#00d4ff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">$149/month · cancel anytime</p>
      <p style="margin:0 0 12px;color:#fff;font-size:18px;font-weight:800;">Daily 7am alerts · Full contact info · License-expiry tracking</p>
      <p style="margin:0 0 16px;color:#cbd5e1;font-size:14px;line-height:1.6;">
        One CNA you would have paid an agency $82/hr for, hired direct at $22/hr — pays for an entire year of TechAlert in a single shift.
      </p>
      <a href="https://detroitwebagent.com/talent-radar/healthcare" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:800;font-size:15px;">Start TechAlert →</a>
    </div>

    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:16px 0 0;text-align:center;">
      Want to talk first? Reply to this email or text Matt at <a href="sms:+13139921219" style="color:#00d4ff;text-decoration:none;">(313) 992-1219</a>.
    </p>
  </td></tr>

  <tr><td style="background:#0a1628;border:1px solid #1e293b;border-top:none;border-radius:0 0 10px 10px;padding:16px 28px;color:#64748b;font-size:12px;">
    Detroit Web Agency · TechAlert · matt@detroitwebagent.com<br>
    Sourced from Michigan Department of Licensing and Regulatory Affairs (LARA) public records.
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

    if (RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@detroitwebagent.com>",
          to: [email],
          reply_to: "matt@detroitwebagent.com",
          subject: `Your 10 free candidates${county ? ` from ${county}` : ""} (TechAlert)`,
          html,
        }),
      });
      if (!r.ok) console.error("[lead-magnet] resend error:", await r.text());
    }

    // 3. Notify Matt (a real lead just hit — call them today)
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
    const ADMIN = "+13138064952";
    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      const body = `[TechAlert lead] ${agency || "—"} · ${email}${county ? ` · ${county}` : ""}${phone ? ` · ${phone}` : ""}. Call within 5 min.`;
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: TWILIO_FROM, To: ADMIN, Body: body }).toString(),
      }).catch(e => console.warn("[lead-magnet] sms warn:", e));
    }

    return new Response(JSON.stringify({ success: true, candidates: candidates?.length || 0 }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[lead-magnet] error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
