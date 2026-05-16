// agency-prospect-list-blast — one-click 50-prospect teaser to a staffing agency
// Pulls top 50 matching candidates, shows 5 in email + "45 more" teaser, sends via Resend.
// Triggered manually from AdminAgencyOutreach for each enriched agency.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateWithOpus } from "../_shared/opus.ts";
import { frequencyCapExceeded } from "../_shared/outreach-blocklist.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HC_RX = /\b(rn|lpn|cna|nurse|nursing|aide|home\s*health|caregiver|medical|clinical|therapist|hha|healthcare|health)\b/i;
const IND_RX = /\b(boiler|hvac|electric|plumb|stationary\s+engineer|machinist|welder|fitter|pipefitter|fabricat|cnc|millwright|trades|mechanic|technician)\b/i;

function matchesVertical(candidate: any, vertical: string): boolean {
  const text = `${candidate.trade || ""} ${candidate.current_title || ""} ${candidate.license_type || ""}`;
  return vertical === "healthcare" ? HC_RX.test(text) : IND_RX.test(text);
}

function scoreBar(score: number): string {
  const color = score >= 9 ? "#10b981" : score >= 7 ? "#f59e0b" : "#94a3b8";
  const label = score >= 9 ? "🔥 Hot" : score >= 7 ? "Strong" : "Good";
  return `<span style="background:${color}22;color:${color};font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;">${label} ${score}/10</span>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    const {
      agency_name,
      agency_email,
      agency_contact_name,
      agency_contact_title,
      vertical = "industrial",
      agency_note = "",
      tier = "standard",
      // whitelabel: send from agency's own brand (requires sender_name + sender_email)
      sender_name,
      sender_email,
      recipient_email,
      recipient_name,
    } = body;

    if (!agency_name || !agency_email) {
      return new Response(JSON.stringify({ ok: false, error: "agency_name and agency_email required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Pull recent candidates (last 7 days), ordered by score
    const { data: allCandidates } = await sb
      .from("hire_alert_candidates")
      .select("id, name, full_name, trade, city, state, score, current_title, license_type, years_experience, qualifications_summary")
      .eq("is_company_name", false)
      .eq("do_not_contact", false)
      .gte("created_at", sevenDaysAgo)
      .order("score", { ascending: false })
      .limit(200);

    const matched = (allCandidates || []).filter(c => matchesVertical(c, vertical));
    const top5 = matched.slice(0, 5);
    const remaining = Math.max(0, matched.length - 5);
    const totalCount = Math.min(matched.length, 50);

    if (totalCount === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No matching candidates found this week" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // AI-written intro paragraph (Opus for quality)
    const firstName = agency_contact_name?.split(" ")[0] || "there";
    const candBullets = top5.map(c =>
      `• ${c.full_name || c.name} — ${c.current_title || c.trade || "trade professional"}, ${c.city || "MI"} (Score ${c.score ?? "N/A"}/10${c.years_experience ? ", " + c.years_experience + " yrs exp" : ""})`
    ).join("\n");

    const prompt = `Write a 3-sentence cold email intro (no subject line, no sign-off) from Matt Michels at Detroit Web Agency to ${firstName}, ${agency_contact_title || "Recruiting Director"} at ${agency_name}.

Context: ${agency_note || `${agency_name} is a Michigan staffing agency`}.

We're sending them a teaser preview of ${totalCount} pre-screened ${vertical} candidates we've identified this week through our TechAlert intelligence platform. These are licensed, active trade professionals showing job-seeking signals — not random résumés.

Here are 5 example candidates from the list:
${candBullets}

The email should:
- Open with a specific reference to ${agency_name}'s ${vertical} focus
- Mention we spotted ${totalCount} candidates this week using our signal monitoring
- Tease the value ("you're seeing 5 — there are ${remaining} more") without being salesy
- Be direct and conversational, NOT corporate
- End with a soft ask: "Worth a quick call to see the rest of the list?"

Output ONLY the 3-sentence intro paragraph. No subject line, no greeting, no sign-off.`;

    const intro = await generateWithOpus(prompt, 200).catch(() =>
      `We spotted ${totalCount} pre-screened ${vertical} candidates in Michigan this week through our signal monitoring platform — people showing active signs of looking for their next role. Here are 5 of them. Worth a quick call to see the rest of the list?`
    );

    // Build HTML email
    const candidateCards = top5.map(c => {
      const name = c.full_name || c.name;
      const role = c.current_title || c.trade || c.license_type || "Trade Professional";
      const location = [c.city, c.state || "MI"].filter(Boolean).join(", ");
      const exp = c.years_experience ? `${c.years_experience} yrs` : "";
      const summary = c.qualifications_summary ? `<p style="color:#94a3b8;font-size:11px;margin:6px 0 0;font-style:italic;">${c.qualifications_summary.slice(0, 100)}…</p>` : "";
      return `
<div style="background:rgba(0,212,255,0.04);border:1px solid rgba(0,212,255,0.15);border-radius:10px;padding:14px 16px;margin-bottom:10px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
    <div style="min-width:0;">
      <p style="color:white;font-size:14px;font-weight:700;margin:0;">${name}</p>
      <p style="color:#94a3b8;font-size:12px;margin:3px 0 0;">${role} · ${location}${exp ? " · " + exp : ""}</p>
      ${summary}
    </div>
    <div style="flex-shrink:0;">${scoreBar(c.score ?? 5)}</div>
  </div>
</div>`;
    }).join("");

    const lockedRows = remaining > 0 ? Array.from({ length: Math.min(remaining, 5) }, (_, i) => `
<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;margin-bottom:10px;filter:blur(3px);user-select:none;">
  <p style="color:#475569;font-size:14px;font-weight:700;margin:0;">████████████</p>
  <p style="color:#334155;font-size:12px;margin:3px 0 0;">${vertical === "healthcare" ? ["RN", "LPN", "CNA", "CRNA", "Therapist"][i % 5] : ["HVAC Tech", "Electrician", "Plumber", "Boiler Op.", "Machinist"][i % 5]} · Metro Detroit</p>
</div>`).join("") : "";

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0a1628,#0d1f2e);border:1px solid rgba(0,212,255,0.15);border-radius:12px 12px 0 0;padding:28px 28px 20px;">
    <p style="color:#00d4ff;font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;">⚡ TechAlert Intelligence — ${agency_name}</p>
    <h1 style="color:white;font-size:22px;font-weight:900;margin:0;">${totalCount} Pre-Screened ${vertical === "healthcare" ? "Healthcare" : "Trades"} Candidates — This Week</h1>
    <p style="color:#64748b;font-size:12px;margin:8px 0 0;">Spotted via signal monitoring · Week of ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
  </td></tr>

  <!-- Intro -->
  <tr><td style="background:#0d1b2e;border-left:1px solid rgba(0,212,255,0.1);border-right:1px solid rgba(0,212,255,0.1);padding:24px 28px;">
    <p style="color:#cbd5e1;font-size:14px;line-height:1.8;margin:0;">${intro.replace(/\n/g, "<br>")}</p>
  </td></tr>

  <!-- Live candidate cards -->
  <tr><td style="background:#0d1b2e;border-left:1px solid rgba(0,212,255,0.1);border-right:1px solid rgba(0,212,255,0.1);padding:0 28px 8px;">
    <p style="color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Live Preview — 5 of ${totalCount}</p>
    ${candidateCards}
  </td></tr>

  ${remaining > 0 ? `
  <!-- Locked cards -->
  <tr><td style="background:#0d1b2e;border-left:1px solid rgba(0,212,255,0.1);border-right:1px solid rgba(0,212,255,0.1);padding:0 28px 8px;">
    <p style="color:#475569;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">+ ${remaining} More Candidates — Locked</p>
    ${lockedRows}
    <div style="text-align:center;margin:16px 0 8px;">
      <p style="color:#64748b;font-size:12px;">Contact Matt to unlock the full list.</p>
    </div>
  </td></tr>` : ""}

  <!-- CTA -->
  <tr><td style="background:#0d1b2e;border-left:1px solid rgba(0,212,255,0.1);border-right:1px solid rgba(0,212,255,0.1);padding:8px 28px 28px;text-align:center;">
    <a href="tel:+13139921219" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;margin-right:12px;">📞 Call (313) 992-1219</a>
    <a href="mailto:matt@detroitwebagent.com?subject=TechAlert%20Candidate%20List%20—%20${encodeURIComponent(agency_name)}" style="display:inline-block;background:rgba(0,212,255,0.1);color:#00d4ff;font-weight:700;font-size:13px;padding:14px 24px;border-radius:10px;text-decoration:none;border:1px solid rgba(0,212,255,0.3);">Reply to this email →</a>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#080f1a;border:1px solid rgba(255,255,255,0.05);border-radius:0 0 12px 12px;padding:16px 28px;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
      <div>
        <p style="color:white;font-size:12px;font-weight:700;margin:0;">Matt Michels</p>
        <p style="color:#475569;font-size:10px;margin:0;">Detroit Web Agency · matt@detroitwebagent.com · (313) 992-1219</p>
      </div>
    </div>
    <p style="color:#334155;font-size:9px;margin:12px 0 0;">You're receiving this because ${agency_name} operates in the ${vertical} staffing space in Michigan. Reply "REMOVE" to opt out.</p>
  </td></tr>

</table></td></tr></table>
</body></html>`;

    const subject = `${totalCount} Pre-Screened ${vertical === "healthcare" ? "Healthcare" : "Trades"} Candidates Available This Week — ${agency_name}`;

    // Send via Resend
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY not set" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const isWhitelabel = tier === "whitelabel" && sender_name && sender_email;
    const fromAddress = isWhitelabel
      ? `${sender_name} <${sender_email}>`
      : "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>";
    const toAddress = isWhitelabel ? (recipient_email || agency_email) : agency_email;

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress,
        to: [toAddress],
        bcc: ["matt@detroitwebagent.com"],
        subject,
        html,
      }),
    });

    const sendData = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Resend error ${sendRes.status}: ${JSON.stringify(sendData)}` }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Log the send
    await sb.from("agency_outreach_sends" as any).insert({
      agency_name,
      agency_email,
      candidate_count: totalCount,
      vertical,
      subject,
      sent_at: new Date().toISOString(),
      resend_id: (sendData as any).id || null,
    }).catch(() => {}); // non-fatal if table doesn't exist yet

    return new Response(
      JSON.stringify({ ok: true, sent_to: agency_email, subject, candidate_count: totalCount, resend_id: (sendData as any).id }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
