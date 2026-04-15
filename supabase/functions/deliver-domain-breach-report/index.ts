import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HIBP_API_KEY       = Deno.env.get("HIBP_API_KEY") || "";
const RESEND_API_KEY     = Deno.env.get("RESEND_API_KEY") || "";

function classifySeverity(dataClasses: string[]): string {
  const lower = dataClasses.map(d => d.toLowerCase());
  if (lower.some(d => d.includes("password"))) return "critical";
  if (lower.some(d => d.includes("credit card") || d.includes("bank account"))) return "high";
  if (dataClasses.length >= 3) return "medium";
  return "low";
}

const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
};

function buildEmail(domain: string, breaches: any[], affectedEmails: number): string {
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const hasBreaches = breaches.length > 0;

  const rows = breaches.map(b => {
    const color = SEV_COLOR[b.severity] || "#94a3b8";
    return `<div style="background:#0d1526;border:1px solid #1e2d4a;border-radius:8px;padding:18px 20px;margin-bottom:14px">
      <div style="margin-bottom:8px">
        <span style="font-size:15px;font-weight:700;color:#e2e8f0">${b.title}</span>
        <span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;background:${color}22;color:${color};border:1px solid ${color}44;font-size:11px;font-weight:700;text-transform:uppercase">${b.severity}</span>
      </div>
      <div style="font-size:12px;color:#64748b;margin-bottom:10px">Breach date: ${b.date || "Unknown"} · ${b.pwnCount ? b.pwnCount.toLocaleString() + " records" : "Unknown records"}</div>
      <div style="margin-bottom:10px">
        <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em">Data exposed</span><br>
        <span style="font-size:13px;color:#cbd5e1">${b.dataClasses.join(", ")}</span>
      </div>
      ${b.remediation ? `<div style="background:#0a1628;border-left:3px solid #00d4ff;padding:12px 14px;border-radius:0 6px 6px 0;margin-top:8px">
        <span style="font-size:11px;font-weight:700;color:#00d4ff;text-transform:uppercase;letter-spacing:.08em">Recommended Actions</span>
        <div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-top:6px;white-space:pre-line">${b.remediation}</div>
      </div>` : ""}
    </div>`;
  }).join("");

  const alertBanner = hasBreaches
    ? `<div style="background:#ef444415;border:1px solid #ef444430;border-radius:8px;padding:14px 18px;margin-bottom:22px"><span style="font-size:13px;color:#fca5a5">⚠️ <strong>${breaches.length} breach${breaches.length > 1 ? "es" : ""}</strong> found · <strong>${affectedEmails} email address${affectedEmails !== 1 ? "es" : ""} exposed</strong></span></div>`
    : `<div style="background:#22c55e15;border:1px solid #22c55e30;border-radius:8px;padding:14px 18px;margin-bottom:22px"><span style="font-size:13px;color:#86efac">✅ No dark web breaches found for <strong>${domain}</strong> — checked against 12B+ compromised accounts across 600+ breaches.</span></div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#060c18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px">
<table width="100%" style="max-width:600px">
  <tr><td style="background:#0a0f1e;padding:22px 28px;border-radius:10px 10px 0 0;border:1px solid #1e2d4a;border-bottom:none">
    <p style="margin:0;color:#00d4ff;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase">Detroit Web Agency · Domain Breach Report</p>
    <h1 style="margin:6px 0 0;color:#e2e8f0;font-size:20px;font-weight:700">${hasBreaches ? `⚠️ ${breaches.length} Breach${breaches.length > 1 ? "es" : ""} Found` : "✅ No Breaches Found"} — ${domain}</h1>
    <p style="margin:4px 0 0;color:#475569;font-size:12px">${date}</p>
  </td></tr>
  <tr><td style="background:#0a0f1e;padding:24px 28px;border:1px solid #1e2d4a;border-top:none;border-bottom:none">
    ${alertBanner}${rows}
  </td></tr>
  <tr><td style="background:#0a0f1e;padding:18px 28px;border:1px solid #1e2d4a;border-top:none;border-radius:0 0 10px 10px">
    <p style="margin:0;font-size:12px;color:#475569"><strong style="color:#94a3b8">Matt Michels · Detroit Web Agency</strong><br>
    <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none">(313) 992-1219</a></p>
    <p style="margin:8px 0 0;font-size:11px;color:#334155">Data from <a href="https://haveibeenpwned.com" style="color:#00d4ff">HaveIBeenPwned.com</a> — trusted by 1Password, Firefox, and the UK NCSC.</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HIBP_DETAIL_CAP = 50;

serve(async (req) => {
  // Auth: only accept calls from service role (webhook invoker)
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ") || authHeader.slice(7) !== SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { customer_email, domain, stripe_session_id } = await req.json();
    if (!customer_email || !domain) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }
    if (!EMAIL_RE.test(customer_email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Idempotency: look up order by stripe_session_id; skip if already delivered
    let orderId: string | null = null;
    if (stripe_session_id) {
      const { data: order } = await sb
        .from("domain_breach_orders")
        .select("id, report_sent_at")
        .eq("stripe_session_id", stripe_session_id)
        .single();
      if (order?.report_sent_at) {
        console.log(`[DOMAIN-BREACH] Already delivered for session ${stripe_session_id}, skipping`);
        return new Response(JSON.stringify({ already_sent: true }), { status: 200 });
      }
      orderId = order?.id ?? null;
    }

    console.log(`[DOMAIN-BREACH] Scanning ${domain} for ${customer_email}`);

    const breaches: any[] = [];
    let affectedEmailCount = 0;

    if (HIBP_API_KEY) {
      const hibpRes = await fetch(
        `https://haveibeenpwned.com/api/v3/breacheddomain/${encodeURIComponent(domain)}`,
        { headers: { "hibp-api-key": HIBP_API_KEY, "user-agent": "M2-DomainBreachReport/1.0" } }
      );
      if (hibpRes.status === 200) {
        const emailBreaches: Record<string, string[]> = await hibpRes.json();
        affectedEmailCount = Object.keys(emailBreaches).length;
        const allBreachNames = new Set<string>();
        for (const names of Object.values(emailBreaches)) names.forEach(n => allBreachNames.add(n));
        // Cap to avoid timeout/quota exhaustion
        const breachList = Array.from(allBreachNames).slice(0, HIBP_DETAIL_CAP);
        for (const breachName of breachList) {
          const dr = await fetch(
            `https://haveibeenpwned.com/api/v3/breach/${encodeURIComponent(breachName)}`,
            { headers: { "hibp-api-key": HIBP_API_KEY, "user-agent": "M2-DomainBreachReport/1.0" } }
          );
          if (dr.status === 200) breaches.push(await dr.json());
          await new Promise(r => setTimeout(r, 200));
        }
      } else if (hibpRes.status !== 404) {
        console.error(`[DOMAIN-BREACH] HIBP ${hibpRes.status} for ${domain}`);
      }
    }

    const reportBreaches = await Promise.all(breaches.map(async (b) => {
      const dataClasses: string[] = b.DataClasses || [];
      const severity = classifySeverity(dataClasses);
      let remediation = "";
      if (severity === "critical" || severity === "high") {
        try {
          remediation = await generateText(
            `Company domain "${domain}" appeared in the "${b.Title || b.Name}" breach. Exposed: ${dataClasses.join(", ")}. Write 3 specific remediation steps for their IT team. Numbered list, plain text.`,
            400
          ) || "1. Force password reset for all affected accounts immediately.\n2. Enable MFA on all accounts.\n3. Audit third-party app access and revoke unused permissions.";
        } catch {
          remediation = "1. Force password reset immediately.\n2. Enable multi-factor authentication.\n3. Monitor accounts for suspicious activity.";
        }
      }
      return { title: b.Title || b.Name, date: b.BreachDate || "", dataClasses, pwnCount: b.PwnCount || 0, severity, remediation };
    }));

    reportBreaches.sort((a, b) => {
      const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (o[a.severity] ?? 3) - (o[b.severity] ?? 3);
    });

    if (RESEND_API_KEY) {
      const subject = reportBreaches.length > 0
        ? `⚠️ ${reportBreaches.length} Breach${reportBreaches.length > 1 ? "es" : ""} Found — ${domain}`
        : `✅ No Breaches Found — ${domain}`;
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [customer_email],
          bcc: ["matthewmichels4@gmail.com"],
          subject,
          html: buildEmail(domain, reportBreaches, affectedEmailCount),
        }),
      });
      if (!resendRes.ok) {
        const resendErr = await resendRes.json().catch(() => ({}));
        throw new Error(`Resend failed: ${resendRes.status} ${JSON.stringify(resendErr)}`);
      }
    }

    if (orderId) {
      await sb.from("domain_breach_orders").update({
        breach_count: reportBreaches.length,
        affected_emails: affectedEmailCount,
        report_sent_at: new Date().toISOString(),
      }).eq("id", orderId);
    }

    console.log(`[DOMAIN-BREACH] Done — ${domain}: ${reportBreaches.length} breaches, ${affectedEmailCount} emails`);
    return new Response(JSON.stringify({ breaches: reportBreaches.length, affected_emails: affectedEmailCount }), { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DOMAIN-BREACH] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
