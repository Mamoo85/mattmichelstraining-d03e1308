// Dark Web Domain Scan — weekly cron (or manual trigger)
// For each active dark_web_monitor_clients row:
//   1. Calls HIBP breacheddomain API
//   2. Upserts new findings
//   3. Calls Claude Haiku for AI remediation on new findings
//   4. Sends weekly email report via Resend (dark navy theme)
//   5. 1500ms delay between clients for HIBP rate limiting
//
// SETUP NOTE: HIBP_API_KEY must be added to Supabase secrets.
//   Get a free key at: https://haveibeenpwned.com/API/Key
//   Add via: supabase secrets set HIBP_API_KEY=your_key_here

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HIBP_API_KEY       = Deno.env.get("HIBP_API_KEY") || "";
const RESEND_API_KEY     = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY    = Deno.env.get("LOVABLE_API_KEY") || "";

// ── Severity classification ──────────────────────────────────────────────────
function classifySeverity(dataClasses: string[]): string {
  const lower = dataClasses.map((d) => d.toLowerCase());
  if (lower.some((d) => d.includes("password"))) return "critical";
  if (lower.some((d) => d.includes("credit card") || d.includes("bank account"))) return "high";
  if (dataClasses.length >= 2) return "medium";
  return "low";
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#22c55e",
};

// ── Claude Haiku remediation (via Lovable AI gateway) ────────────────────────
async function generateRemediation(breachTitle: string, dataTypes: string[]): Promise<string> {
  if (!LOVABLE_API_KEY) return "Rotate passwords immediately, enable MFA, and monitor accounts for suspicious activity.";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4-5",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `A company email domain was found in the "${breachTitle}" data breach. Exposed data types: ${dataTypes.join(", ")}.
Write 3 concise, actionable remediation steps for the company's IT team. Be specific. No fluff. Plain text, numbered list.`,
        }],
      }),
    });
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || "Rotate affected credentials, enable MFA, and audit active sessions.";
  } catch {
    return "Rotate affected credentials, enable MFA on all accounts, and notify affected users immediately.";
  }
}

// ── Dark-themed weekly email HTML ─────────────────────────────────────────────
function buildEmailHtml(opts: {
  domain: string;
  hasNewFindings: boolean;
  allFindings: Array<{
    breach_title: string;
    breach_date: string;
    data_types_exposed: string;
    severity: string;
    pwn_count: number | null;
    ai_remediation: string | null;
    is_new: boolean;
  }>;
}): string {
  const { domain, hasNewFindings, allFindings } = opts;
  const subject = hasNewFindings
    ? `⚠️ New Breach Found for ${domain}`
    : `✅ All Clear for ${domain}`;
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const findingRows = allFindings.map((f) => {
    const color = SEVERITY_COLOR[f.severity] || "#94a3b8";
    const badge = `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${color}22;color:${color};border:1px solid ${color}44;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">${f.severity}</span>`;
    const newBadge = f.is_new ? `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#00d4ff22;color:#00d4ff;border:1px solid #00d4ff44;font-size:11px;font-weight:700;margin-left:6px">NEW</span>` : "";
    return `
    <div style="background:#0d1526;border:1px solid #1e2d4a;border-radius:8px;padding:18px 20px;margin-bottom:14px">
      <div style="margin-bottom:8px">
        <span style="font-size:15px;font-weight:700;color:#e2e8f0">${f.breach_title || "Unknown Breach"}</span>
        ${badge}${newBadge}
      </div>
      <div style="font-size:12px;color:#64748b;margin-bottom:10px">
        Breach date: ${f.breach_date || "Unknown"} · Records exposed: ${f.pwn_count ? f.pwn_count.toLocaleString() : "Unknown"}
      </div>
      <div style="margin-bottom:10px">
        <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em">Data types exposed</span><br>
        <span style="font-size:13px;color:#cbd5e1">${f.data_types_exposed || "Unknown"}</span>
      </div>
      ${f.ai_remediation ? `
      <div style="background:#0a1628;border-left:3px solid #00d4ff;padding:12px 14px;border-radius:0 6px 6px 0;margin-top:8px">
        <span style="font-size:11px;font-weight:700;color:#00d4ff;text-transform:uppercase;letter-spacing:.08em">AI Remediation Steps</span>
        <div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-top:6px;white-space:pre-line">${f.ai_remediation}</div>
      </div>` : ""}
    </div>`;
  }).join("");

  const emptyState = `
    <div style="text-align:center;padding:40px 20px;background:#0d1526;border:1px solid #1e2d4a;border-radius:8px">
      <div style="font-size:36px;margin-bottom:12px">✅</div>
      <div style="font-size:16px;font-weight:700;color:#22c55e;margin-bottom:8px">No breaches found for ${domain}</div>
      <div style="font-size:13px;color:#64748b">We continuously monitor the dark web for your domain credentials. We'll alert you the moment anything appears.</div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060c18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060c18">
<tr><td align="center" style="padding:24px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

  <!-- Header -->
  <tr><td style="background:#0a0f1e;padding:22px 28px;border-radius:10px 10px 0 0;border:1px solid #1e2d4a;border-bottom:none">
    <p style="margin:0;color:#00d4ff;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase">M² Development · Dark Web Monitor</p>
    <h1 style="margin:6px 0 0;color:#e2e8f0;font-size:20px;font-weight:700">${subject}</h1>
    <p style="margin:4px 0 0;color:#475569;font-size:12px">${dateStr} · Monitoring: <strong style="color:#94a3b8">${domain}</strong></p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#0a0f1e;padding:24px 28px;border:1px solid #1e2d4a;border-top:none;border-bottom:none">
    ${hasNewFindings
      ? `<div style="background:#ef444415;border:1px solid #ef444430;border-radius:8px;padding:14px 18px;margin-bottom:22px">
           <span style="font-size:13px;color:#fca5a5">⚠️ <strong>${allFindings.filter((f) => f.is_new).length} new breach(es)</strong> detected for <strong>${domain}</strong>. Immediate action recommended.</span>
         </div>`
      : `<div style="background:#22c55e15;border:1px solid #22c55e30;border-radius:8px;padding:14px 18px;margin-bottom:22px">
           <span style="font-size:13px;color:#86efac">✅ No new credential exposures detected this week for <strong>${domain}</strong>.</span>
         </div>`}
    ${allFindings.length > 0 ? findingRows : emptyState}
  </td></tr>

  <!-- Signature -->
  <tr><td style="background:#0a0f1e;padding:18px 28px;border:1px solid #1e2d4a;border-top:none;border-radius:0 0 10px 10px">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #1e2d4a" />
      <div style="font-size:12px;color:#475569">
        <strong style="color:#94a3b8">Matt Michels · M² Development</strong><br>
        Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#00d4ff;text-decoration:none">(313) 806-4952</a>
      </div>
      <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2" style="width:32px;height:32px;margin-left:auto;object-fit:contain" />
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (!HIBP_API_KEY) {
      console.warn("[DARK-WEB-SCAN] HIBP_API_KEY not set. Add via: supabase secrets set HIBP_API_KEY=your_key");
    }

    // Fetch all active clients
    const { data: clients, error: clientsErr } = await sb
      .from("dark_web_monitor_clients")
      .select("*")
      .eq("subscription_status", "active");

    if (clientsErr) throw clientsErr;
    if (!clients || clients.length === 0) {
      console.log("[DARK-WEB-SCAN] No active clients");
      return new Response(JSON.stringify({ scanned: 0 }), { status: 200 });
    }

    let scanned = 0;

    for (const client of clients) {
      try {
        const domain = client.monitored_domain;
        console.log(`[DARK-WEB-SCAN] Scanning domain: ${domain} for client ${client.id}`);

        // Call HIBP breached domain API
        let breaches: any[] = [];
        if (HIBP_API_KEY) {
          const hibpRes = await fetch(
            `https://haveibeenpwned.com/api/v3/breacheddomain/${encodeURIComponent(domain)}`,
            {
              headers: {
                "hibp-api-key": HIBP_API_KEY,
                "user-agent": "M2-DarkWebMonitor/1.0",
              },
            }
          );

          if (hibpRes.status === 200) {
            // Returns { "email@domain.com": ["BreachName1", "BreachName2"] }
            // We want to cross-reference with breach details
            const emailBreaches: Record<string, string[]> = await hibpRes.json();
            const allBreachNames = new Set<string>();
            for (const names of Object.values(emailBreaches)) {
              names.forEach((n) => allBreachNames.add(n));
            }

            // Fetch breach details for each unique breach name
            for (const breachName of allBreachNames) {
              const detailRes = await fetch(
                `https://haveibeenpwned.com/api/v3/breach/${encodeURIComponent(breachName)}`,
                {
                  headers: {
                    "hibp-api-key": HIBP_API_KEY,
                    "user-agent": "M2-DarkWebMonitor/1.0",
                  },
                }
              );
              if (detailRes.status === 200) {
                breaches.push(await detailRes.json());
              }
              // Small delay between detail requests
              await new Promise((r) => setTimeout(r, 200));
            }
          } else if (hibpRes.status === 404) {
            // 404 = domain not found in any breaches — normal, not an error
            console.log(`[DARK-WEB-SCAN] No breaches found for ${domain} (HIBP 404)`);
          } else {
            const errText = await hibpRes.text();
            console.error(`[DARK-WEB-SCAN] HIBP error ${hibpRes.status} for ${domain}: ${errText}`);
          }
        }

        // Process each breach
        const newFindingIds: string[] = [];

        for (const breach of breaches) {
          const dataClasses: string[] = breach.DataClasses || [];
          const severity = classifySeverity(dataClasses);
          const dataTypesStr = dataClasses.join(", ");

          // Upsert — unique constraint (client_id, breach_name) prevents dupes
          const { data: existing } = await sb
            .from("dark_web_monitor_findings")
            .select("id, is_new")
            .eq("client_id", client.id)
            .eq("breach_name", breach.Name)
            .maybeSingle();

          if (!existing) {
            // New finding — generate AI remediation
            const remediation = await generateRemediation(breach.Title || breach.Name, dataClasses);

            const { data: inserted } = await sb
              .from("dark_web_monitor_findings")
              .insert({
                client_id:          client.id,
                domain,
                breach_name:        breach.Name,
                breach_title:       breach.Title || breach.Name,
                breach_date:        breach.BreachDate || null,
                data_types_exposed: dataTypesStr,
                pwn_count:          breach.PwnCount || null,
                severity,
                is_new:             true,
                ai_remediation:     remediation,
              })
              .select("id")
              .single();

            if (inserted) newFindingIds.push(inserted.id);
          }
        }

        // Update last_scan_at
        await sb
          .from("dark_web_monitor_clients")
          .update({ last_scan_at: new Date().toISOString() })
          .eq("id", client.id);

        // Fetch all findings for this client to include in the email
        const { data: allFindings } = await sb
          .from("dark_web_monitor_findings")
          .select("*")
          .eq("client_id", client.id)
          .order("first_seen_at", { ascending: false })
          .limit(20);

        const hasNewFindings = newFindingIds.length > 0;

        // Send weekly email report
        if (RESEND_API_KEY && client.customer_email) {
          const emailHtml = buildEmailHtml({
            domain,
            hasNewFindings,
            allFindings: (allFindings || []).map((f: any) => ({
              breach_title:       f.breach_title,
              breach_date:        f.breach_date,
              data_types_exposed: f.data_types_exposed,
              severity:           f.severity,
              pwn_count:          f.pwn_count,
              ai_remediation:     f.ai_remediation,
              is_new:             f.is_new,
            })),
          });

          const emailSubject = hasNewFindings
            ? `⚠️ New Breach Found for ${domain}`
            : `✅ All Clear for ${domain}`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Dark Web Monitor <matt@mattmichelstraining.com>",
              to: [client.customer_email],
              bcc: ["matthewmichels4@gmail.com"],
              subject: emailSubject,
              html: emailHtml,
            }),
          });

          // Mark findings as reported
          if (allFindings && allFindings.length > 0) {
            const reportedNow = new Date().toISOString();
            await sb
              .from("dark_web_monitor_findings")
              .update({ reported_at: reportedNow, is_new: false })
              .in("id", allFindings.map((f: any) => f.id));
          }

          console.log(`[DARK-WEB-SCAN] Email sent to ${client.customer_email} — ${domain} (${hasNewFindings ? `${newFindingIds.length} new findings` : "all clear"})`);
        }

        scanned++;
      } catch (clientErr) {
        console.error(`[DARK-WEB-SCAN] Error processing client ${client.id}:`, clientErr);
      }

      // 1500ms delay between clients for HIBP rate limiting
      if (clients.indexOf(client) < clients.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    console.log(`[DARK-WEB-SCAN] Completed — scanned ${scanned} clients`);
    return new Response(JSON.stringify({ scanned }), { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DARK-WEB-SCAN] Fatal error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
