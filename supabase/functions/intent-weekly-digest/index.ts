// intent-weekly-digest — Monday 7am ET email to Matt with top 10 intent-delta
// accounts of the past 7 days, each with a 2-sentence "why now" from Claude Haiku.
//
// Powered by intent_score_snapshots (current vs 7d-ago delta).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateWithHaiku } from "../_shared/opus.ts";
import { logError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL = "matt@detroitwebagent.com";
const ADMIN_BASE_URL = "https://detroitwebagent.com/dwa-admin";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Get latest snapshot per account + their snapshot from ~7 days ago
    const { data: latest, error: lErr } = await sb
      .from("v_latest_intent_scores")
      .select("account_key, company_name, location, vertical, score, signal_count, category_count, trajectory_delta_14d, contributing_signals")
      .gte("score", 40)
      .order("trajectory_delta_14d", { ascending: false, nullsFirst: false })
      .limit(20);
    if (lErr) throw lErr;

    const top10 = (latest || []).filter((r) => (r.trajectory_delta_14d ?? 0) > 0).slice(0, 10);

    if (top10.length === 0) {
      console.log("[weekly-digest] No qualifying accounts; skipping email.");
      return new Response(JSON.stringify({ ok: true, skipped: "no_movers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate "why now" for each in parallel
    const enriched = await Promise.all(top10.map(async (acct) => {
      const sigs = (acct.contributing_signals as any[] || []).slice(0, 5)
        .map((s) => `${s.display_label} (${s.category})`)
        .join("; ");
      const prompt = `Account: ${acct.company_name} (${acct.location}, ${acct.vertical}). Recent signals: ${sigs}. Score jumped ${Math.round(acct.trajectory_delta_14d || 0)} pts in 14 days. Write exactly 2 short sentences explaining WHY NOW is the moment to pitch them. Be specific to the signals. No fluff.`;
      const why = await generateWithHaiku(prompt, "You are a B2B sales analyst. 2 sentences. Direct.", 200).catch(() => "");
      return { ...acct, why_now: why || `Score climbing fast — ${acct.signal_count} signals across ${acct.category_count} categories.` };
    }));

    const rows = enriched.map((a, i) => `
      <tr style="border-bottom:1px solid #1e293b;">
        <td style="padding:14px 8px;color:#94a3b8;font-family:monospace;">#${i + 1}</td>
        <td style="padding:14px 8px;">
          <a href="${ADMIN_BASE_URL}?account=${encodeURIComponent(a.account_key)}" style="color:#00d4ff;font-weight:700;text-decoration:none;">${a.company_name}</a>
          <div style="color:#64748b;font-size:12px;margin-top:2px;">${a.location || ""} · ${a.vertical || ""}</div>
          <div style="color:#cbd5e1;font-size:13px;margin-top:6px;line-height:1.5;">${a.why_now}</div>
        </td>
        <td style="padding:14px 8px;text-align:right;">
          <div style="color:#10b981;font-weight:700;font-size:18px;">+${Math.round(a.trajectory_delta_14d || 0)}</div>
          <div style="color:#64748b;font-size:11px;">${Math.round(a.score)}/100</div>
        </td>
      </tr>`).join("");

    const html = `<!doctype html><html><body style="background:#0a1628;color:#cbd5e1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;">
<div style="max-width:640px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
  <div style="padding:24px;border-bottom:1px solid #1e293b;">
    <div style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Detroit Web Agency · Intel Brief</div>
    <h1 style="color:#f8fafc;font-size:22px;margin:8px 0 4px;">📈 Top 10 Movers This Week</h1>
    <div style="color:#94a3b8;font-size:13px;">Accounts with the biggest intent-score jumps. Click any name to open the pitch console.</div>
  </div>
  <table style="width:100%;border-collapse:collapse;">${rows}</table>
  <div style="padding:18px 24px;border-top:1px solid #1e293b;color:#64748b;font-size:12px;">
    <a href="${ADMIN_BASE_URL}/approval-queue" style="color:#00d4ff;text-decoration:none;font-weight:600;">→ Open Approval Queue</a> · drafts waiting for your tap.
  </div>
</div></body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "DWA Intel <matt@detroitwebagent.com>",
        to: [ADMIN_EMAIL],
        subject: `📈 ${top10.length} accounts heating up — top movers this week`,
        html,
      }),
    });

    const sendData = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(sendData)}`);

    return new Response(JSON.stringify({ ok: true, count: top10.length, message_id: (sendData as any).id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[intent-weekly-digest] FAIL:", msg);
    await logError({ source: "edge_function", function_name: "intent-weekly-digest", severity: "error", error_message: msg }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
