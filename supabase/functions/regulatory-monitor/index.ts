// regulatory-monitor — cron every Monday 8am ET (0 13 * * 1)
// Searches for regulatory changes per client's agencies/industry,
// emails weekly brief, SMS if urgent compliance action required.

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function firecrawlSearch(query: string): Promise<string> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 4 }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const results = data.data || [];
    return results
      .map((r: { title?: string; url?: string; markdown?: string }) =>
        `SOURCE: ${r.title || r.url || ""}\nURL: ${r.url || ""}\n${(r.markdown || "").slice(0, 500)}`
      )
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}

async function sendSMS(to: string, body: string): Promise<void> {
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekOf = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const results: string[] = [];

  try {
    const { data: clients, error } = await sb
      .from("regulatory_monitor_clients")
      .select("*")
      .eq("active", true);

    if (error) throw error;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ message: "No active clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const client of clients) {
      try {
        const industry: string = client.industry || "general business";
        const agencies: string[] = client.regulatory_agencies || [];
        const searchResults: string[] = [];

        // Search for each agency's updates
        for (const agency of agencies.slice(0, 4)) {
          const agencyResults = await firecrawlSearch(
            `${agency} new rule regulation 2026`
          );
          if (agencyResults) {
            searchResults.push(`=== ${agency} ===\n${agencyResults}`);
          }
        }

        // Search for industry compliance updates
        const industryResults = await firecrawlSearch(
          `${industry} compliance update ${monthYear}`
        );
        if (industryResults) {
          searchResults.push(`=== ${industry} Industry Update ===\n${industryResults}`);
        }

        const combinedResults = searchResults.join("\n\n") || "No recent regulatory updates found.";

        const prompt = `You are a regulatory compliance expert. Analyze the following search results and create a weekly regulatory brief for a ${industry} business.

CLIENT: ${client.name || client.email}
INDUSTRY: ${industry}
REGULATORY BODIES MONITORED: ${agencies.join(", ") || "General"}
WEEK OF: ${weekOf}

SEARCH RESULTS:
${combinedResults}

Generate a comprehensive regulatory brief in JSON format:
{
  "changes": [
    {
      "agency": "Agency name",
      "title": "Rule/regulation title",
      "summary": "2-3 sentence plain English explanation",
      "actionRequired": true/false,
      "actionDescription": "What specifically the business must do (if action required)",
      "deadline": "Compliance deadline if known, or null",
      "urgency": "immediate/soon/monitoring",
      "sourceUrl": "URL if available"
    }
  ],
  "hasUrgentItem": true/false,
  "urgentSmsText": "SMS text for urgent items (max 160 chars) or null",
  "executiveSummary": "2-3 sentence executive summary of the week's regulatory landscape",
  "briefHtml": "Full HTML weekly brief with all changes formatted cleanly with color-coded urgency indicators"
}

Rules:
- Only include changes that are genuinely relevant to ${industry}
- If no meaningful changes found, say so clearly in the executive summary
- Mark 'actionRequired: true' only if the business must actually DO something
- 'immediate' urgency = deadline within 30 days or already in effect
- Plain English throughout — no legalese`;

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

        const aiJson = await aiRes.json();
        const rawText = aiJson.content?.[0]?.text || "{}";

        let parsed: {
          changes?: Array<{
            agency: string;
            title: string;
            summary: string;
            actionRequired: boolean;
            actionDescription?: string;
            deadline?: string;
            urgency: string;
            sourceUrl?: string;
          }>;
          hasUrgentItem?: boolean;
          urgentSmsText?: string;
          executiveSummary?: string;
          briefHtml?: string;
        } = {};
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch {
          parsed = { briefHtml: rawText, hasUrgentItem: false };
        }

        const actionItems = (parsed.changes || []).filter((c) => c.actionRequired);
        const urgencyBadge = (urgency: string) => {
          const colors: Record<string, string> = {
            immediate: "#dc2626",
            soon: "#d97706",
            monitoring: "#16a34a",
          };
          return `<span style="background:${colors[urgency] || "#64748b"};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;">${urgency.toUpperCase()}</span>`;
        };

        const changesHtml = (parsed.changes || [])
          .map(
            (c) => `
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <strong>${c.agency}</strong> ${urgencyBadge(c.urgency)}
              ${c.actionRequired ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;">ACTION REQUIRED</span>' : ""}
            </div>
            <h3 style="margin:0 0 8px;color:#1e293b;">${c.title}</h3>
            <p style="margin:0 0 8px;color:#475569;">${c.summary}</p>
            ${c.actionRequired && c.actionDescription ? `<div style="background:#fef9c3;border-left:4px solid #eab308;padding:12px;border-radius:0 8px 8px 0;margin-top:8px;"><strong>What to do:</strong> ${c.actionDescription}</div>` : ""}
            ${c.deadline ? `<p style="margin:8px 0 0;font-size:13px;color:#dc2626;"><strong>Deadline:</strong> ${c.deadline}</p>` : ""}
            ${c.sourceUrl ? `<a href="${c.sourceUrl}" style="font-size:12px;color:#e8621a;">View source →</a>` : ""}
          </div>`
          )
          .join("");

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:750px;margin:0 auto;padding:20px;color:#1e293b;}
  h1{color:#e8621a;border-bottom:2px solid #e8621a;padding-bottom:8px;}
  .summary-box{background:#f8fafc;border-left:4px solid #e8621a;padding:16px;margin-bottom:24px;border-radius:0 8px 8px 0;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;}
</style></head>
<body>
<h1>Weekly Regulatory Brief</h1>
<p style="color:#64748b;">Week of ${weekOf} | ${industry} | Monitored agencies: ${agencies.join(", ") || "General"}</p>
<div class="summary-box">
  <strong>Executive Summary:</strong><br>${parsed.executiveSummary || "No significant changes this week."}
  ${actionItems.length > 0 ? `<br><br><strong style="color:#dc2626;">⚠️ ${actionItems.length} item(s) require your action this week.</strong>` : ""}
</div>
${changesHtml || parsed.briefHtml || "<p>No regulatory changes found this week.</p>"}
<div class="footer">
  <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;vertical-align:middle;margin-right:8px;" alt="Matt">
  <span>Matt Michels | M² Performance Training | matt@mattmichelstraining.com | (313) 806-4952</span>
</div>
</body>
</html>`;

        const subject = parsed.hasUrgentItem
          ? `🚨 URGENT Regulatory Action Required — Week of ${weekOf}`
          : `📋 Weekly Regulatory Brief — Week of ${weekOf}`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            to: [client.email],
            subject,
            html: emailHtml,
          }),
        });

        if (parsed.hasUrgentItem && client.phone && parsed.urgentSmsText) {
          await sendSMS(
            client.phone,
            `🚨 M² Regulatory Alert: ${parsed.urgentSmsText} | Full brief sent to your email.`
          );
        }

        await sb
          .from("regulatory_monitor_clients")
          .update({ last_alert_at: new Date().toISOString() })
          .eq("id", client.id);

        results.push(`✓ ${client.email} — ${(parsed.changes || []).length} changes found`);
      } catch (clientErr) {
        results.push(`✗ ${client.email} — ${clientErr}`);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("regulatory-monitor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
