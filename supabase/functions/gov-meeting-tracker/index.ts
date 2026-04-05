// gov-meeting-tracker — cron every Monday 8am ET (0 13 * * 1) + Wednesday (0 13 * * 3)
// Searches city council/planning agendas for client keywords,
// emails weekly brief, SMS if urgent vote this week.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
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
        `SOURCE: ${r.title || r.url || ""}\nURL: ${r.url || ""}\n${(r.markdown || "").slice(0, 700)}`
      )
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const weekOf = now.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
  });
  const year = now.getFullYear();
  const results: string[] = [];

  try {
    const { data: clients, error } = await sb
      .from("gov_meeting_tracker_clients")
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
        const city: string = client.city || "";
        const keywords: string[] = client.keywords || [];
        const keywordStr = keywords.join(", ");
        const searchResults: string[] = [];

        // Search city council agendas
        const councilResults = await firecrawlSearch(
          `${city} city council agenda ${year} ${keywords[0] || ""}`
        );
        if (councilResults) {
          searchResults.push(`=== CITY COUNCIL AGENDAS ===\n${councilResults}`);
        }

        // Search planning commission / zoning
        const planningResults = await firecrawlSearch(
          `${city} planning commission meeting zoning ${year}`
        );
        if (planningResults) {
          searchResults.push(`=== PLANNING COMMISSION ===\n${planningResults}`);
        }

        // Search building permits with client keywords
        const permitResults = await firecrawlSearch(
          `${city} building permit ${keywords[0] || ""} ${year}`
        );
        if (permitResults) {
          searchResults.push(`=== BUILDING PERMITS ===\n${permitResults}`);
        }

        const combinedResults = searchResults.join("\n\n") || "No recent government meeting data found.";

        const prompt = `You are a government affairs intelligence analyst. Analyze the following government meeting and planning data for a client in ${city}.

CLIENT: ${client.name || client.email}
CITY/JURISDICTION: ${city}
KEYWORDS TO WATCH: ${keywordStr || "general business, development, zoning"}
WEEK OF: ${weekOf}

SEARCH RESULTS FROM GOVERNMENT SOURCES:
${combinedResults}

Generate a comprehensive government meeting tracker brief in JSON format:
{
  "items": [
    {
      "type": "city_council/planning/permit/other",
      "title": "Item title",
      "summary": "2-3 sentence plain English summary of what's being proposed or decided",
      "status": "upcoming_vote/approved/denied/under_review/public_comment",
      "meetingDate": "Date if known",
      "keywordMatch": ["which of the client's keywords this matches"],
      "relevanceScore": 1-10,
      "isUrgent": true/false,
      "urgentReason": "Why it's urgent (vote this week, immediate impact, etc.) or null",
      "whatItMeansForClient": "1-2 sentences on how this specifically affects ${client.name || "the client"}'s interests"
    }
  ],
  "hasUrgentItem": true/false,
  "urgentSmsText": "SMS-friendly urgent alert (max 160 chars) or null",
  "approvedThisWeek": ["List of items that were approved"],
  "deniedThisWeek": ["List of items that were denied"],
  "upcomingVotes": ["Items with votes scheduled in the next 7 days"],
  "keywordMentions": ["Direct keyword matches found in the data"],
  "executiveSummary": "3-4 sentence summary of the week's government activity relevant to this client",
  "actionItems": ["Specific actions the client should consider taking based on what was found"]
}

Rules:
- Only include items genuinely relevant to the client's keywords or business type
- Mark isUrgent=true ONLY if there is a vote happening within 7 days or immediate compliance required
- Be specific about dates and meeting names when they appear in the data
- If minimal relevant data found, say so clearly and note what to watch`;

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
          items?: Array<{
            type: string;
            title: string;
            summary: string;
            status: string;
            meetingDate?: string;
            keywordMatch?: string[];
            relevanceScore?: number;
            isUrgent?: boolean;
            urgentReason?: string;
            whatItMeansForClient?: string;
          }>;
          hasUrgentItem?: boolean;
          urgentSmsText?: string;
          approvedThisWeek?: string[];
          deniedThisWeek?: string[];
          upcomingVotes?: string[];
          keywordMentions?: string[];
          executiveSummary?: string;
          actionItems?: string[];
        } = {};
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch {
          parsed = { executiveSummary: rawText, hasUrgentItem: false };
        }

        const statusColors: Record<string, string> = {
          upcoming_vote: "#d97706",
          approved: "#16a34a",
          denied: "#dc2626",
          under_review: "#7c3aed",
          public_comment: "#0ea5e9",
        };

        const itemsHtml = (parsed.items || [])
          .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
          .map((item) => {
            const statusColor = statusColors[item.status] || "#64748b";
            const statusLabel = item.status.replace(/_/g, " ").toUpperCase();
            return `
            <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;${item.isUrgent ? "border-left:4px solid #dc2626;" : ""}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                ${item.isUrgent ? '<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;">⚡ URGENT</span>' : ""}
                <span style="background:${statusColor};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;">${statusLabel}</span>
                <span style="font-size:12px;color:#64748b;">${item.type.replace(/_/g, " ")}</span>
                ${item.meetingDate ? `<span style="font-size:12px;color:#64748b;">📅 ${item.meetingDate}</span>` : ""}
              </div>
              <h3 style="margin:0 0 8px;color:#1e293b;font-size:15px;">${item.title}</h3>
              <p style="margin:0 0 8px;color:#475569;font-size:14px;">${item.summary}</p>
              ${item.whatItMeansForClient ? `<div style="background:#f0f9ff;border-left:3px solid #0ea5e9;padding:8px 12px;border-radius:0 6px 6px 0;font-size:13px;color:#0c4a6e;"><strong>What this means for you:</strong> ${item.whatItMeansForClient}</div>` : ""}
              ${item.urgentReason ? `<p style="margin:8px 0 0;font-size:13px;color:#dc2626;font-weight:bold;">⚠️ ${item.urgentReason}</p>` : ""}
            </div>`;
          })
          .join("");

        const quickStatsHtml = `
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
  <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:24px;font-weight:bold;color:#16a34a;">${(parsed.approvedThisWeek || []).length}</div>
    <div style="font-size:12px;color:#64748b;">Approved</div>
  </div>
  <div style="background:#fef2f2;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:24px;font-weight:bold;color:#dc2626;">${(parsed.deniedThisWeek || []).length}</div>
    <div style="font-size:12px;color:#64748b;">Denied</div>
  </div>
  <div style="background:#fffbeb;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:24px;font-weight:bold;color:#d97706;">${(parsed.upcomingVotes || []).length}</div>
    <div style="font-size:12px;color:#64748b;">Upcoming Votes</div>
  </div>
</div>`;

        const actionHtml = parsed.actionItems?.length
          ? `<div style="background:#fff8f0;border-left:4px solid #e8621a;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
              <strong>Recommended Actions:</strong>
              <ul style="margin:8px 0 0;padding-left:20px;">
                ${parsed.actionItems.map((a) => `<li style="margin-bottom:4px;">${a}</li>`).join("")}
              </ul>
            </div>`
          : "";

        const subject = parsed.hasUrgentItem
          ? `⚡ URGENT: Vote This Week — ${city} Government Alert`
          : `🏛️ Weekly Gov Meeting Tracker — ${city} — ${weekOf}`;

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:750px;margin:0 auto;padding:20px;color:#1e293b;}
  h1{color:#e8621a;border-bottom:2px solid #e8621a;padding-bottom:8px;}
  h2{color:#1e293b;margin-top:24px;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;}
</style></head>
<body>
<h1>Government Meeting Tracker</h1>
<p style="color:#64748b;">Week of ${weekOf} | ${city} | Watching: ${keywordStr || "general"}</p>

<div style="background:#f8fafc;border-left:4px solid #e8621a;padding:16px;margin-bottom:24px;border-radius:0 8px 8px 0;">
  <strong>This Week's Summary:</strong><br>${parsed.executiveSummary || "No significant activity found this week."}
</div>

${quickStatsHtml}
${actionHtml}

${itemsHtml ? `<h2>Relevant Items Found</h2>${itemsHtml}` : "<p style='color:#64748b;'>No highly relevant items found this week. Monitoring continues.</p>"}

${parsed.keywordMentions?.length ? `
<div style="background:#f0f9ff;border-radius:8px;padding:16px;margin-top:16px;">
  <strong>Keyword Mentions Found:</strong>
  <div style="margin-top:8px;">${parsed.keywordMentions.map((k) => `<span style="display:inline-block;background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:12px;font-size:12px;margin:2px;">${k}</span>`).join(" ")}</div>
</div>` : ""}

<div class="footer">
  <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;vertical-align:middle;margin-right:8px;" alt="Matt">
  <span>Matt Michels | M2 Development | matt@mattmichelstraining.com | (313) 806-4952</span>
</div>
</body>
</html>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
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
            TWILIO_PHONE_NUMBER,
            `🏛️ M² Gov Alert [${city}]: ${parsed.urgentSmsText} | Full brief in your email.`,
            "gov_meeting_tracker"
          );
        }

        await sb
          .from("gov_meeting_tracker_clients")
          .update({ last_report_at: new Date().toISOString() })
          .eq("id", client.id);

        results.push(`✓ ${client.email} — items: ${(parsed.items || []).length}, urgent: ${parsed.hasUrgentItem}`);
      } catch (clientErr) {
        results.push(`✗ ${client.email} — ${clientErr}`);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gov-meeting-tracker error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
