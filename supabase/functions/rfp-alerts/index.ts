// RFP Alert Scanner — cron weekdays 9am ET (0 14 * * 1-5)
// Searches for government/state RFP opportunities for each client via Firecrawl + Claude scoring

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

async function notifyMatt(subject: string, html: string) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² System <matt@mattmichelstraining.com>",
      to: ["matt@mattmichelstraining.com"],
      subject,
      html,
    }),
  });
}

async function sendSMS(to: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) return;
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body }),
    }
  );
}

async function firecrawlSearch(query: string): Promise<Array<{ url: string; markdown: string; title: string }>> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
    });
    const data = await res.json();
    return data?.data || [];
  } catch (e) {
    console.error("[rfp-alerts] Firecrawl error:", e);
    return [];
  }
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: clients, error } = await sb
    .from("rfp_alert_clients")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error("[rfp-alerts] DB error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!clients?.length) {
    console.log("[rfp-alerts] No active clients");
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  const todayStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  let alertsSent = 0;

  for (const client of clients) {
    try {
      const services = client.services || client.business_type || "professional services";
      const geography = client.geography || client.state || "Michigan";
      const contactName = client.contact_name || "there";
      const businessName = client.business_name || "your business";

      // Run two parallel Firecrawl searches
      const [samResults, stateResults] = await Promise.all([
        firecrawlSearch(`site:sam.gov ${services} ${geography} contract opportunity 2026`),
        firecrawlSearch(`${geography} state procurement ${services} RFP bid 2026`),
      ]);

      const allResults = [...samResults, ...stateResults];

      if (!allResults.length) {
        console.log(`[rfp-alerts] No results for ${businessName}`);
        await sb.from("rfp_alert_clients").update({ last_alert_at: new Date().toISOString() }).eq("id", client.id);
        continue;
      }

      // Build context for Claude
      const searchContext = allResults
        .slice(0, 8)
        .map((r, i) => `Result ${i + 1}:\nTitle: ${r.title}\nURL: ${r.url}\nContent: ${r.markdown?.slice(0, 400)}`)
        .join("\n\n---\n\n");

      const prompt = `You are an expert government procurement analyst. Review these search results and identify real RFP/contract opportunities for this business.

Business: ${businessName}
Services They Offer: ${services}
Geographic Focus: ${geography}
Today's Date: ${todayStr}

Search Results:
${searchContext}

For each genuine opportunity found (skip news articles, general pages, or irrelevant results), provide:

Return a JSON array of opportunities. Each opportunity object must have:
- title: string (opportunity name)
- agency: string (issuing agency/government body)
- url: string (direct link)
- deadline: string (application deadline or "Not specified")
- estimated_value: string (contract value or "Not specified")
- fit_score: number (1-100, how well this matches their services and geography)
- why_it_fits: string (2 sentences explaining the match)

If no genuine opportunities are found in the results, return an empty array [].

Return ONLY the JSON array, no other text.`;

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const aiData = await aiRes.json();
      const rawText = aiData?.content?.[0]?.text || "[]";

      let opportunities: Array<{
        title: string;
        agency: string;
        url: string;
        deadline: string;
        estimated_value: string;
        fit_score: number;
        why_it_fits: string;
      }> = [];

      try {
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        opportunities = JSON.parse(jsonMatch?.[0] || "[]");
      } catch {
        console.error(`[rfp-alerts] JSON parse error for ${businessName}`);
        opportunities = [];
      }

      // Filter to 60+ score
      const qualified = opportunities.filter((o) => o.fit_score >= 60);
      const highPriority = qualified.filter((o) => o.fit_score >= 80);

      if (!qualified.length) {
        await sb.from("rfp_alert_clients").update({ last_alert_at: new Date().toISOString() }).eq("id", client.id);
        continue;
      }

      // Sort by fit score descending
      qualified.sort((a, b) => b.fit_score - a.fit_score);

      // Build email HTML
      const opportunityCards = qualified
        .map(
          (opp) => `
        <div style="border:1px solid ${opp.fit_score >= 80 ? "#fbbf24" : "#e2e8f0"};border-radius:8px;padding:20px;margin:0 0 16px;background:${opp.fit_score >= 80 ? "#fffbeb" : "#fff"};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin:0 0 8px;">
            <p style="margin:0;font-size:15px;font-weight:700;color:#1e293b;">${opp.title}</p>
            <span style="background:${opp.fit_score >= 80 ? "#e8621a" : "#64748b"};color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;margin-left:12px;">
              ${opp.fit_score}/100 ${opp.fit_score >= 80 ? "🔥" : ""}
            </span>
          </div>
          <p style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong>Agency:</strong> ${opp.agency}</p>
          <p style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong>Deadline:</strong> ${opp.deadline} · <strong>Est. Value:</strong> ${opp.estimated_value}</p>
          <p style="margin:0 0 12px;font-size:13px;color:#334155;line-height:1.6;">${opp.why_it_fits}</p>
          <a href="${opp.url}" style="background:#e8621a;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:700;font-size:12px;">View Opportunity →</a>
        </div>`
        )
        .join("");

      if (RESEND_API_KEY && client.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² RFP Alerts <matt@mattmichelstraining.com>",
            to: [client.email],
            subject: `${qualified.length} RFP ${qualified.length === 1 ? "Opportunity" : "Opportunities"} Found — ${todayStr}`,
            html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">

  <tr><td style="background:#1e293b;padding:24px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">M² RFP Alert System</p>
    <p style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Your Daily RFP Report</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${todayStr} · ${qualified.length} qualified ${qualified.length === 1 ? "opportunity" : "opportunities"} found</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 24px;">Hi ${contactName}, here are today's RFP opportunities matching your profile for <strong>${services}</strong> in <strong>${geography}</strong>.</p>

    ${highPriority.length ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#9a3412;font-weight:600;">🔥 ${highPriority.length} HIGH PRIORITY ${highPriority.length === 1 ? "opportunity" : "opportunities"} (80+ fit score) — you've also been texted</p>
    </div>` : ""}

    ${opportunityCards}

    <hr style="border:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:13px;color:#64748b;line-height:1.7;">Opportunities are scored 1-100 based on fit with your services and geography. Opportunities with 80+ scores trigger an SMS alert. Reply to adjust your search profile.</p>
  </td></tr>

  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M² RFP Alert System · (313) 806-4952</div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
          }),
        });
        alertsSent++;
      }

      // SMS for 80+ score opportunities
      if (highPriority.length && client.phone) {
        const topOpp = highPriority[0];
        const smsBody = `M² RFP Alert 🔥\n${highPriority.length} high-priority ${highPriority.length === 1 ? "contract" : "contracts"} found for ${businessName}!\n\nTop match: ${topOpp.title} (${topOpp.fit_score}/100)\nDeadline: ${topOpp.deadline}\n\nCheck your email for full details.`;
        await sendSMS(client.phone, smsBody);
      }

      // Update last_alert_at
      await sb
        .from("rfp_alert_clients")
        .update({ last_alert_at: new Date().toISOString() })
        .eq("id", client.id);

      console.log(`[rfp-alerts] Sent ${qualified.length} opportunities to ${businessName}`);
    } catch (e) {
      console.error(`[rfp-alerts] Error for client ${client.id}:`, e);
    }
  }

  await notifyMatt(
    `RFP Alerts Run — ${todayStr} (${alertsSent} clients alerted)`,
    `<div style="font-family:sans-serif;max-width:500px;padding:24px;">
<h2 style="color:#e8621a;">RFP Alert Daily Run</h2>
<p><strong>Date:</strong> ${todayStr}</p>
<p><strong>Clients processed:</strong> ${clients.length}</p>
<p><strong>Alert emails sent:</strong> ${alertsSent}</p>
</div>`
  );

  return new Response(JSON.stringify({ processed: clients.length, alertsSent }), { status: 200 });
});
