// create-counsel-beta-invite — admin-only tool to grant a 30-day free trial to Jess (or any beta user)
// Returns a magic link that signs them straight into /my-counsel-search.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "auth_invalid" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: roleCheck } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!roleCheck) return new Response(JSON.stringify({ error: "admin_required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let body: { email?: string; contact_name?: string; firm_name?: string; days?: number; note?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const days = Math.min(Math.max(Number(body.days) || 30, 1), 90);
  const contactName = (body.contact_name || "").trim().slice(0, 200);
  const firmName = (body.firm_name || "").trim().slice(0, 200);
  const note = (body.note || "").trim().slice(0, 500);

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
    invited_by_admin: user.id,
    invite_note: note || `Beta invite — ${days} day free access`,
  }, { onConflict: "email" });

  if (upsertErr) {
    return new Response(JSON.stringify({ error: "db_error", message: upsertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const magicLink = `https://detroitwebagent.com/my-counsel-search?email=${encodeURIComponent(email)}&token=${dashboardToken}`;
  const consoleLink = `https://detroitwebagent.com/counsel-search/console`;

  // Branded welcome email
  if (RESEND_API_KEY) {
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
    <p style="font-size:12px;color:#94a3b8;margin:24px 0 0">Trial ends ${new Date(trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Need help? Text Matt at (313) 992-1219.</p>
  </div>
  <div style="background:#f1f5f9;padding:16px;text-align:center;font-size:11px;color:#94a3b8">
    Detroit Web Agency · Counsel Records Search · Not a Consumer Reporting Agency. For permissible litigation use only (FCRA §1681b(a)(4)).
  </div>
</div></body></html>`;

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [email],
          subject: `${contactName ? contactName.split(" ")[0] + ", your" : "Your"} ${days}-day Counsel Records Search access is live`,
          html,
        }),
      });
    } catch (_e) { /* non-fatal */ }
  }

  return new Response(JSON.stringify({
    ok: true,
    magic_link: magicLink,
    console_link: consoleLink,
    trial_ends_at: trialEndsAt,
    email,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
