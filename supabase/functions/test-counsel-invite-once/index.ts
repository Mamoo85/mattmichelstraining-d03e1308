// TEMPORARY — service-role gated test runner for counsel beta invite email.
// Will be deleted after Jess's invite is sent.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-test-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  // Gate: hardcoded one-shot secret (function will be deleted right after use)
  const SECRET = "tc7-9q4r-8x2p-jess-beta-test-2026";
  if (req.headers.get("x-test-secret") !== SECRET) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const contactName = String(body.contact_name || "").trim();
  const firmName = String(body.firm_name || "").trim();
  const days = Math.min(Math.max(Number(body.days) || 30, 1), 90);
  const note = String(body.note || "").trim();
  const sendEmail = body.send_email !== false;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const trialEndsAt = new Date(Date.now() + days * 86400000).toISOString();
  const dashboardToken = crypto.randomUUID().replace(/-/g, "");

  const { error: upsertErr } = await sb.from("counsel_search_clients").upsert({
    email,
    contact_name: contactName || null,
    firm_name: firmName || null,
    tier: "beta",
    active: true,
    monitoring_enabled: false,
    dashboard_token: dashboardToken,
    trial_ends_at: trialEndsAt,
    invite_note: note || `Beta invite — ${days} day free access`,
  }, { onConflict: "email" });

  if (upsertErr) {
    return new Response(JSON.stringify({ error: "db_error", message: upsertErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const magicLink = `https://detroitwebagent.com/my-counsel-search?email=${encodeURIComponent(email)}&token=${dashboardToken}`;
  const consoleLink = `https://detroitwebagent.com/counsel-search/console`;

  let emailStatus: unknown = "skipped";
  if (sendEmail && RESEND_API_KEY) {
    const firstName = contactName ? contactName.split(" ")[0] : "there";
    const feedbackBody = `Hi Matt,\n\nWhat worked:\n\n\nWhat broke or felt off:\n\n\nThings I'd like added or done differently:\n\n\n— ${contactName || email}`;
    const feedbackMailto = `mailto:matt@detroitwebagent.com?subject=${encodeURIComponent(`Counsel Search feedback — ${firstName}`)}&body=${encodeURIComponent(feedbackBody)}`;

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f7fa;margin:0;padding:32px 16px;color:#0a1628">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#030711;padding:24px;text-align:center">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;margin:0">⚖️ COUNSEL RECORDS SEARCH</p>
  </div>
  <div style="padding:32px 28px">
    <h1 style="font-size:22px;margin:0 0 16px;font-weight:700">${contactName ? `${contactName}, your` : "Your"} ${days}-day free access is live.</h1>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 20px">
      Federal court (PACER/CourtListener), MI dockets (36th District, Wayne, Oakland, Macomb), MDOC, NSOPW, county parcels, blight, AI-corroborated web research — every cite HEAD-validated. One click. Built for litigators.
    </p>
    <p style="margin:24px 0">
      <a href="${magicLink}" style="display:inline-block;background:#00d4ff;color:#030711;font-weight:700;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:14px">Open My Dashboard →</a>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 12px"><strong>Run your first search:</strong> <a href="${consoleLink}" style="color:#0891b2">${consoleLink}</a></p>
    <p style="font-size:13px;line-height:1.5;color:#64748b;margin:24px 0 0;padding:16px;background:#f1f5f9;border-radius:6px;border-left:3px solid #00d4ff">
      <strong>Court-citable output:</strong> Every search now includes a complete source list (Bluebook-formatted) and a one-click <strong>Print PDF</strong> button so you can drop results straight into a brief or hand them to opposing counsel.
    </p>
    <div style="margin:28px 0 0;padding:20px;background:#fff7ed;border:2px solid #fb923c;border-radius:8px">
      <h2 style="font-size:16px;margin:0 0 8px;color:#9a3412;font-weight:800">Does it work? What's missing?</h2>
      <p style="font-size:14px;line-height:1.55;color:#7c2d12;margin:0 0 14px">
        I built this for you${contactName ? `, ${firstName}` : ""} — please tell me if anything is broken, confusing, or missing. Hit the button below and the email will pre-fill with a quick form (what worked, what broke, what you'd like added or done differently).
      </p>
      <p style="margin:0 0 10px">
        <a href="${feedbackMailto}" style="display:inline-block;background:#ea580c;color:#ffffff;font-weight:700;padding:12px 22px;border-radius:6px;text-decoration:none;font-size:14px">Reply with feedback →</a>
      </p>
      <p style="font-size:12px;color:#9a3412;margin:8px 0 0">Or text me direct: <strong>(313) 992-1219</strong></p>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin:24px 0 0">Trial ends ${new Date(trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>
  </div>
  <div style="background:#f1f5f9;padding:16px;text-align:center;font-size:11px;color:#94a3b8">
    Detroit Web Agency · Counsel Records Search · Not a Consumer Reporting Agency. For permissible litigation use only (FCRA §1681b(a)(4)).
  </div>
</div></body></html>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Detroit Web Agency <matt@detroitwebagent.com>",
        to: [email],
        subject: `${contactName ? firstName + ", your" : "Your"} ${days}-day Counsel Records Search access is live`,
        html,
      }),
    });
    emailStatus = { status: r.status, body: await r.text() };
  }

  return new Response(JSON.stringify({
    ok: true,
    email,
    magic_link: magicLink,
    console_link: consoleLink,
    trial_ends_at: trialEndsAt,
    email_send: emailStatus,
  }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
