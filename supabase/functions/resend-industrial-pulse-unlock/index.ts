// Admin tool — re-send the Industrial Pulse unlock email for an existing unlock row.
// Looks up the unlock by id, regenerates the same signal table the webhook sends,
// and emails it via Resend. Does NOT change unlock status or billing.
//
// POST { unlock_id: string }
// Auth: requires service-role bearer token (admin-only via edge call from admin UI).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const FROM = "Matt Michels <matt@detroitwebagent.com>";
const REPLY_TO = "matt@detroitwebagent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendEmail(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
  return await r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Service-role guard — only the admin UI invoking via supabase.functions.invoke
  // (which forwards the user's session) OR direct service-role calls succeed.
  const auth = req.headers.get("authorization") || "";
  if (!auth) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { unlock_id } = await req.json();
    if (!unlock_id || typeof unlock_id !== "string") {
      return new Response(JSON.stringify({ error: "unlock_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify caller is an admin via has_role
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const callerId = userRes?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "not signed in" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: unlock, error: uErr } = await sb
      .from("industrial_pulse_unlocks")
      .select("id, email, plan, status, week_start")
      .eq("id", unlock_id)
      .maybeSingle();
    if (uErr) throw uErr;
    if (!unlock) throw new Error("unlock not found");

    const isSubscription = unlock.plan === "firehose_199";
    const planLabel = isSubscription ? "$199/mo Firehose" : "$50 Snapshot";

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signals } = await sb
      .from("industry_pulse_signals")
      // deno-lint-ignore no-explicit-any
      .select("company_name, location, industry, hiring_roles, hiring_count, predicted_needs, confidence" as any)
      .gte("detected_at", sevenDaysAgo)
      .gte("confidence", 7)
      .order("confidence", { ascending: false })
      .limit(isSubscription ? 50 : 25);

    // deno-lint-ignore no-explicit-any
    const rows = ((signals as any[]) || []).map((s) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#fff;font-weight:600;">${s.company_name || "—"}</td>
        <td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#94a3b8;font-size:12px;">${s.location || "Metro Detroit"}</td>
        <td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#cbd5e1;font-size:12px;">${(s.hiring_count || "?")}× ${(s.hiring_roles || []).join(", ")}</td>
        <td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#64748b;font-size:11px;">${(s.predicted_needs || []).slice(0,3).join(" · ")}</td>
        <td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#00d4ff;font-weight:700;text-align:center;">${s.confidence || "-"}/10</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;">
<div style="max-width:680px;margin:0 auto;padding:24px;">
  <div style="border-bottom:2px solid #00d4ff;padding-bottom:16px;margin-bottom:20px;">
    <div style="font-size:11px;letter-spacing:3px;color:#00d4ff;font-weight:700;text-transform:uppercase;">DETROIT INDUSTRIAL PULSE — ${planLabel} (Resent)</div>
    <h1 style="color:#fff;font-size:22px;margin:8px 0 4px;">Here's your unlock again.</h1>
    <p style="color:#64748b;font-size:13px;margin:0;">${(signals || []).length} signals from the last 7 days · confidence ≥ 7/10</p>
  </div>
  <table style="width:100%;border-collapse:collapse;background:#0a1628;border:1px solid #1e3a5f;border-radius:6px;">
    <thead><tr style="background:#0f1e3a;">
      <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;letter-spacing:1px;">COMPANY</th>
      <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;letter-spacing:1px;">LOCATION</th>
      <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;letter-spacing:1px;">HIRING</th>
      <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;letter-spacing:1px;">SPEND</th>
      <th style="padding:10px;text-align:center;color:#00d4ff;font-size:11px;letter-spacing:1px;">CONF</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="5" style="padding:20px;color:#64748b;text-align:center;">No fresh signals right now — radar refreshes hourly. Reply to this email and Matt will send a current batch.</td></tr>`}</tbody>
  </table>
  <p style="color:#475569;font-size:12px;margin-top:24px;border-top:1px solid #1e3a5f;padding-top:12px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
</div></body></html>`;

    await sendEmail(unlock.email, `🔓 Resent — Metro Detroit hiring signals (${planLabel})`, html);

    return new Response(JSON.stringify({
      ok: true,
      to: unlock.email,
      signal_count: (signals || []).length,
      plan: unlock.plan,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[resend-industrial-pulse-unlock]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
