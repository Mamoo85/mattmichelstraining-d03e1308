import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

interface HibpBreach {
  Name: string;
  Domain: string;
  BreachDate: string;
  DataClasses: string[];
}

function calcRiskLevel(breaches: HibpBreach[]): string {
  if (breaches.length === 0) return "clean";
  const hasPasswords = breaches.some(b => b.DataClasses.some(dc => dc.toLowerCase().includes("password")));
  const hasFinancial = breaches.some(b =>
    b.DataClasses.some(dc =>
      dc.toLowerCase().includes("credit card") ||
      dc.toLowerCase().includes("bank") ||
      dc.toLowerCase().includes("financial")
    )
  );
  if (hasPasswords && hasFinancial) return "critical";
  if (hasPasswords && breaches.length >= 3) return "high";
  if (breaches.length >= 3 || (breaches.length >= 1 && hasPasswords)) return "medium";
  return "low";
}

function riskColor(riskLevel: string): string {
  switch (riskLevel) {
    case "clean": return "#16a34a";
    case "low": return "#ca8a04";
    case "medium": return "#ea580c";
    case "high": return "#dc2626";
    case "critical": return "#7f1d1d";
    default: return "#64748b";
  }
}

function riskLabel(riskLevel: string): string {
  switch (riskLevel) {
    case "clean": return "CLEAN \u2713";
    case "low": return "LOW RISK \u26a0";
    case "medium": return "MEDIUM RISK \u26a0";
    case "high": return "HIGH RISK \u26a0";
    case "critical": return "CRITICAL RISK \u26a0";
    default: return "UNKNOWN";
  }
}

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "x-api-key": ANTHROPIC_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data?.content?.[0]?.text || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
    });
  }

  try {
    const { candidate_name, candidate_email, requester_email, is_test, stripe_session_id } = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Insert initial record
    const { data: record, error: insertErr } = await sb
      .from("new_hire_breach_checks")
      .insert({
        requester_email,
        candidate_name,
        candidate_email,
        stripe_session_id: stripe_session_id || null,
        is_test: is_test || false,
        risk_level: "pending",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[NEW-HIRE-BREACH-CHECK] Insert error:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
    }

    const recordId = record.id;

    // Call HIBP
    let breaches: HibpBreach[] = [];
    try {
      const hibpRes = await fetch(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(candidate_email)}?truncateResponse=false`,
        {
          headers: {
            "hibp-api-key": HIBP_API_KEY,
            "user-agent": "M2-NewHireBreachCheck/1.0",
          },
        }
      );
      if (hibpRes.status === 200) {
        breaches = await hibpRes.json();
      } else if (hibpRes.status === 404) {
        breaches = [];
      } else {
        console.error("[NEW-HIRE-BREACH-CHECK] HIBP error status:", hibpRes.status);
      }
    } catch (e) {
      console.error("[NEW-HIRE-BREACH-CHECK] HIBP fetch error:", e);
    }

    const risk_level = calcRiskLevel(breaches);
    const breach_count = breaches.length;
    const has_password_breach = breaches.some(b =>
      b.DataClasses.some(dc => dc.toLowerCase().includes("password"))
    );

    // Call Claude for risk assessment
    let riskAssessment = "";
    try {
      let prompt: string;
      if (breach_count === 0) {
        prompt = `You are a concise HR security analyst. A background credential check found NO data breaches for a job candidate's email address. Write a 3-4 sentence reassuring message suitable for an HR manager's report. Mention the candidate was checked against HaveIBeenPwned's database of 14+ billion compromised accounts and no records were found. Recommend standard onboarding security practices. Keep it professional and factual.`;
      } else {
        const breachSummary = breaches.slice(0, 5).map(b =>
          `${b.Name} (${b.BreachDate}): exposed ${b.DataClasses.join(", ")}`
        ).join("; ");
        prompt = `You are a concise HR security analyst. A background credential check found ${breach_count} data breach(es) for a job candidate's email. Breaches: ${breachSummary}. Risk level: ${risk_level}. Write a 3-4 sentence assessment for an HR manager. Explain what was exposed, what it means for hiring risk, and recommend specific onboarding security actions (such as requiring a password manager + MFA enrollment on day 1). Keep it professional, non-alarmist, and actionable. Do not suggest the breach disqualifies the candidate.`;
      }
      riskAssessment = await callClaude(prompt);
    } catch (e) {
      console.error("[NEW-HIRE-BREACH-CHECK] Claude error:", e);
      riskAssessment = breach_count === 0
        ? "No breach history was found for this email address in the HaveIBeenPwned database, which covers 14+ billion compromised records. This is a positive indicator, though it does not guarantee the absence of unreported breaches. Standard onboarding security practices are still recommended."
        : `This email address appeared in ${breach_count} known data breach(es). Review the breach details and consider requiring a password manager and multi-factor authentication enrollment on the candidate's first day.`;
    }

    // Build email HTML
    const isClean = risk_level === "clean";
    const headerColor = riskColor(risk_level);
    const subjectSuffix = isClean ? "CLEAN \u2713" : `AT RISK \u26a0 (${riskLabel(risk_level)})`;

    let breachTableHtml = "";
    if (breaches.length > 0) {
      const rows = breaches.map(b => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${b.Name}${b.Domain ? ` (${b.Domain})` : ""}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${b.BreachDate}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${b.DataClasses.join(", ")}</td>
        </tr>`).join("");
      breachTableHtml = `
        <div style="margin:20px 0">
          <p style="font-weight:700;margin:0 0 8px;color:#1e293b">Breach History (${breaches.length} found)</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Breach Name</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Date</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Data Exposed</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:${headerColor};padding:24px 28px">
    <p style="color:rgba(255,255,255,0.8);font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 6px">New Hire Credential Check</p>
    <h1 style="color:#fff;margin:0;font-size:22px;font-family:Georgia,serif">${candidate_name}: ${subjectSuffix}</h1>
  </div>
  <div style="padding:24px 28px;color:#1e293b;font-size:15px;line-height:1.7">
    <p style="margin:0 0 16px">Here are the results for <strong>${candidate_email}</strong>:</p>

    <div style="background:${isClean ? "#f0fdf4" : "#fff7ed"};border:1px solid ${isClean ? "#86efac" : "#fed7aa"};border-radius:8px;padding:16px 20px;margin:0 0 20px">
      <p style="margin:0;font-weight:700;font-size:16px;color:${headerColor}">
        ${isClean
          ? `\u2713 No breach history found for ${candidate_email}`
          : `\u26a0 ${breach_count} breach${breach_count !== 1 ? "es" : ""} found for ${candidate_email}`
        }
      </p>
    </div>

    ${breachTableHtml}

    <div style="margin:20px 0">
      <p style="font-weight:700;margin:0 0 8px;color:#1e293b">Risk Assessment</p>
      <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;background:#f8fafc;padding:16px;border-radius:8px;border-left:3px solid ${headerColor}">${riskAssessment}</p>
    </div>

    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6">
        This check used HaveIBeenPwned data. A clean result means no known public breaches — it is not a guarantee against unreported breaches. A breach result does not disqualify a candidate.
      </p>
    </div>

    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">
      <div style="font-size:13px;color:#64748b">
        <strong style="color:#1e293b">M\u00b2 Development</strong><br>
        Powered by HaveIBeenPwned \u00b7 mattmichelstraining.com
      </div>
    </div>
  </div>
</div>
</body></html>`;

    // Send email via Resend
    let report_sent = false;
    if (RESEND_API_KEY) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            to: [requester_email],
            bcc: ["matthewmichels4@gmail.com"],
            subject: `Credential Check \u2014 ${candidate_name}: ${subjectSuffix}`,
            html: emailHtml,
          }),
        });
        if (emailRes.ok) {
          report_sent = true;
        } else {
          console.error("[NEW-HIRE-BREACH-CHECK] Resend error:", await emailRes.text());
        }
      } catch (e) {
        console.error("[NEW-HIRE-BREACH-CHECK] Email send error:", e);
      }
    }

    // Update DB record
    await sb.from("new_hire_breach_checks").update({
      risk_level,
      breach_count,
      has_password_breach,
      report_sent,
    }).eq("id", recordId);

    console.log(`[NEW-HIRE-BREACH-CHECK] Complete — ${candidate_email} — risk: ${risk_level} — breaches: ${breach_count}`);
    return new Response(JSON.stringify({ success: true, risk_level, breach_count }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[NEW-HIRE-BREACH-CHECK] Fatal error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
