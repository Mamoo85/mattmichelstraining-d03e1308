import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

interface BreachResult {
  email: string;
  breaches: {
    name: string;
    domain: string;
    date: string;
    dataClasses: string[];
  }[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkHIBP(email: string): Promise<BreachResult> {
  const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;
  const res = await fetch(url, {
    headers: {
      "hibp-api-key": HIBP_API_KEY,
      "User-Agent": "M2-Employee-Credential-Audit/1.0",
    },
  });

  if (res.status === 404) {
    return { email, breaches: [] };
  }

  if (!res.ok) {
    console.error(`[HIBP] Non-200/404 for ${email}: ${res.status}`);
    return { email, breaches: [] };
  }

  const data = await res.json();
  const breaches = (data || []).map((b: any) => ({
    name: b.Name || "",
    domain: b.Domain || "",
    date: b.BreachDate || "",
    dataClasses: b.DataClasses || [],
  }));

  return { email, breaches };
}

function getSeverity(dataClasses: string[]): "critical" | "high" | "medium" | "low" {
  const lower = dataClasses.map((d) => d.toLowerCase());
  if (lower.some((d) => d.includes("password"))) return "critical";
  if (lower.some((d) => d.includes("credit card") || d.includes("financial") || d.includes("bank"))) return "high";
  if (lower.some((d) => d.includes("phone") || d.includes("address") || d.includes("ssn"))) return "medium";
  return "low";
}

function getHighestSeverity(breaches: BreachResult["breaches"]): "critical" | "high" | "medium" | "low" | "clean" {
  if (breaches.length === 0) return "clean";
  const severities = breaches.flatMap((b) => [getSeverity(b.dataClasses)]);
  if (severities.includes("critical")) return "critical";
  if (severities.includes("high")) return "high";
  if (severities.includes("medium")) return "medium";
  return "low";
}

function severityColor(sev: string): string {
  switch (sev) {
    case "critical": return "#dc2626";
    case "high": return "#ea580c";
    case "medium": return "#d97706";
    case "low": return "#2563eb";
    case "clean": return "#16a34a";
    default: return "#64748b";
  }
}

function buildHtmlEmail(
  companyName: string,
  results: BreachResult[],
  aiSummary: string,
  riskScore: string
): string {
  const totalChecked = results.length;
  const totalBreached = results.filter((r) => r.breaches.length > 0).length;
  const riskColor = riskScore === "HIGH" ? "#dc2626" : riskScore === "MEDIUM" ? "#d97706" : "#16a34a";

  const tableRows = results
    .map((r) => {
      const sev = getHighestSeverity(r.breaches);
      const sevColor = severityColor(sev);
      const breachCount = r.breaches.length;
      const dataExposed = r.breaches.length > 0
        ? [...new Set(r.breaches.flatMap((b) => b.dataClasses))].slice(0, 5).join(", ")
        : "—";
      const recommendation = breachCount === 0
        ? "No action needed — credentials appear clean."
        : sev === "critical"
        ? "Immediately reset this employee's passwords for all accounts."
        : sev === "high"
        ? "Reset passwords and enable MFA on all financial/sensitive accounts."
        : "Advise employee to update passwords as a precaution.";

      return `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 12px;font-size:13px;color:#1e293b;word-break:break-all">${r.email}</td>
        <td style="padding:10px 12px;text-align:center;font-size:13px">
          <span style="font-weight:700;color:${sevColor}">${breachCount}</span>
        </td>
        <td style="padding:10px 12px;text-align:center">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${sevColor}20;color:${sevColor};text-transform:uppercase">${sev}</span>
        </td>
        <td style="padding:10px 12px;font-size:12px;color:#475569">${dataExposed}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569">${recommendation}</td>
      </tr>`;
    })
    .join("");

  const breachedRows = results
    .filter((r) => r.breaches.length > 0)
    .map((r) => {
      const breachDetails = r.breaches
        .map(
          (b) =>
            `<li style="margin-bottom:6px"><strong>${b.name}</strong> (${b.domain}) — ${b.date} — <em>${b.dataClasses.join(", ")}</em></li>`
        )
        .join("");
      return `
      <div style="margin-bottom:20px;padding:16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px">
        <p style="margin:0 0 8px;font-weight:700;color:#1e293b;font-size:14px">${r.email}</p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#475569">${breachDetails}</ul>
      </div>`;
    })
    .join("");

  const aiHtml = aiSummary
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:800px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;margin-top:24px;margin-bottom:24px">

  <!-- Header -->
  <div style="background:#1a2744;padding:28px 32px;border-bottom:4px solid #e8621a">
    <p style="color:#e8621a;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 6px">M² Development · Confidential</p>
    <h1 style="color:#fff;margin:0;font-size:24px;font-family:Georgia,serif">Employee Credential Audit</h1>
    <p style="color:#94a3b8;margin:6px 0 0;font-size:14px">${companyName}</p>
  </div>

  <div style="padding:28px 32px">

    <!-- Summary Stats -->
    <div style="display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap">
      <div style="flex:1;min-width:140px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:900;color:#1e293b">${totalChecked}</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#64748b">Emails Checked</div>
      </div>
      <div style="flex:1;min-width:140px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:900;color:#dc2626">${totalBreached}</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#64748b">Breached Accounts</div>
      </div>
      <div style="flex:1;min-width:140px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:900;color:${riskColor}">${riskScore}</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#64748b">Risk Level</div>
      </div>
      <div style="flex:1;min-width:140px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:900;color:#16a34a">${totalChecked - totalBreached}</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#64748b">Clean Accounts</div>
      </div>
    </div>

    <!-- AI Executive Summary -->
    <div style="background:#1a2744;color:#e2e8f0;padding:20px 24px;border-radius:8px;margin-bottom:28px">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#e8621a;font-weight:700">AI Executive Summary</p>
      <div style="font-size:14px;line-height:1.7">${aiHtml}</div>
    </div>

    <!-- Results Table -->
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 12px">Full Employee Results</h2>
    <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:600">Email</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:600">Breaches</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:600">Severity</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:600">Data Exposed</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:600">Recommended Action</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    ${breachedRows ? `
    <!-- Breach Details -->
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:28px 0 12px">Breach Details</h2>
    ${breachedRows}
    ` : ""}

    <!-- Footer disclaimer -->
    <div style="margin-top:28px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
      <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6">
        <strong style="color:#1e293b">Disclaimer:</strong> This report was generated using HaveIBeenPwned data.
        Credential exposure does not guarantee compromise — it means these credentials appeared in a known public data breach.
        Treat this as a risk indicator. Affected employees should update their passwords immediately, especially if they reuse credentials across accounts.
      </p>
    </div>

    <!-- Signature -->
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt" style="width:44px;height:44px;border-radius:50%;object-fit:cover" />
      <div style="font-size:13px;color:#64748b">
        <strong style="color:#1e293b">Matt Michels</strong><br>
        M² Development · Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#e8621a">(313) 806-4952</a>
      </div>
    </div>
  </div>

  <div style="padding:12px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:11px">M² Development · mattmichelstraining.com · Grosse Pointe, MI · Powered by HaveIBeenPwned</p>
  </div>
</div>
</body>
</html>`;
}

serve(async (req) => {
  try {
    const { audit_id } = await req.json();

    if (!audit_id) {
      return new Response(JSON.stringify({ error: "audit_id is required" }), { status: 400 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch audit record
    const { data: audit, error: fetchError } = await sb
      .from("employee_credential_audits")
      .select("*")
      .eq("id", audit_id)
      .single();

    if (fetchError || !audit) {
      console.error("[EMPLOYEE-CREDENTIAL-SCAN] Audit not found:", fetchError);
      return new Response(JSON.stringify({ error: "Audit not found" }), { status: 404 });
    }

    // Update status to processing
    await sb
      .from("employee_credential_audits")
      .update({ status: "processing" })
      .eq("id", audit_id);

    const emails: string[] = audit.employee_emails || [];
    const companyName: string = audit.company_name;
    const customerEmail: string = audit.customer_email;

    console.log(`[EMPLOYEE-CREDENTIAL-SCAN] Scanning ${emails.length} emails for ${companyName}`);

    // Check each email against HIBP with 1500ms delay
    const results: BreachResult[] = [];
    for (let i = 0; i < emails.length; i++) {
      if (i > 0) await delay(1500);
      const email = emails[i].trim().toLowerCase();
      if (!email) continue;
      const result = await checkHIBP(email);
      results.push(result);
      console.log(`[EMPLOYEE-CREDENTIAL-SCAN] ${email}: ${result.breaches.length} breaches`);
    }

    const totalChecked = results.length;
    const totalBreached = results.filter((r) => r.breaches.length > 0).length;
    const breachRate = totalChecked > 0 ? (totalBreached / totalChecked) : 0;
    const riskScore = breachRate >= 0.30 ? "HIGH" : breachRate >= 0.10 ? "MEDIUM" : "LOW";

    // Build prompt for Claude
    const breachedSummary = results
      .filter((r) => r.breaches.length > 0)
      .map((r) => {
        const breachList = r.breaches
          .map((b) => `  - ${b.name} (${b.date}): ${b.dataClasses.join(", ")}`)
          .join("\n");
        return `${r.email}:\n${breachList}`;
      })
      .join("\n\n");

    const cleanEmails = results.filter((r) => r.breaches.length === 0).map((r) => r.email).join(", ");

    const prompt = `You are a cybersecurity analyst preparing an executive credential audit report for ${companyName}.

Audit results:
- Total employees checked: ${totalChecked}
- Breached accounts: ${totalBreached} (${Math.round(breachRate * 100)}%)
- Clean accounts: ${totalChecked - totalBreached}
- Overall risk level: ${riskScore}

${totalBreached > 0 ? `Breached accounts:\n${breachedSummary}` : "All accounts came back clean — no breaches found."}
${cleanEmails ? `\nClean accounts: ${cleanEmails}` : ""}

Write:
1. An executive summary (2-3 sentences) describing the overall credential health of ${companyName}.
2. For each breached employee: their email, which breaches affected them, what data was exposed, and a 1-sentence recommended action.
3. The overall risk score (${riskScore}) with a brief justification.

Be direct, professional, and actionable. Format with clear sections.`;

    // Call Claude Haiku
    let aiSummary = `${totalBreached} of ${totalChecked} employee email addresses were found in known data breaches. Risk level: ${riskScore}.`;
    try {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (claudeRes.ok) {
        const claudeData = await claudeRes.json();
        aiSummary = claudeData.content?.[0]?.text || aiSummary;
      } else {
        console.error("[EMPLOYEE-CREDENTIAL-SCAN] Claude error:", await claudeRes.text());
      }
    } catch (e) {
      console.error("[EMPLOYEE-CREDENTIAL-SCAN] Claude fetch error:", e);
    }

    // Build and send HTML email via Resend
    const emailHtml = buildHtmlEmail(companyName, results, aiSummary, riskScore);

    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Matt Michels <matt@mattmichelstraining.com>",
          to: [customerEmail],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `Employee Credential Audit — ${companyName}`,
          html: emailHtml,
        }),
      });

      if (!resendRes.ok) {
        console.error("[EMPLOYEE-CREDENTIAL-SCAN] Resend error:", await resendRes.text());
      } else {
        console.log(`[EMPLOYEE-CREDENTIAL-SCAN] Report emailed to ${customerEmail}`);
      }
    } catch (e) {
      console.error("[EMPLOYEE-CREDENTIAL-SCAN] Resend fetch error:", e);
    }

    // Update DB record
    await sb
      .from("employee_credential_audits")
      .update({
        status: "complete",
        total_checked: totalChecked,
        total_breached: totalBreached,
        report_sent: true,
      })
      .eq("id", audit_id);

    return new Response(JSON.stringify({ success: true, total_checked: totalChecked, total_breached: totalBreached, risk_score: riskScore }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[EMPLOYEE-CREDENTIAL-SCAN] Fatal error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
