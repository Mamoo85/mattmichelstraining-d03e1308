// ag-price-alerts — cron daily 7am ET (0 12 * * 1-5)
// Fetches commodity prices via Firecrawl, runs Claude analysis,
// emails morning market brief to all clients, SMS if threshold hit.

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
      body: JSON.stringify({ query, limit: 5 }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const results = data.data || [];
    return results
      .map((r: { title?: string; url?: string; markdown?: string }) =>
        `[${r.title || ""}](${r.url || ""})\n${(r.markdown || "").slice(0, 600)}`
      )
      .join("\n\n");
  } catch {
    return "";
  }
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Matt Michels <matt@mattmichelstraining.com>",
      to: [to],
      subject,
      html,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
  const results: string[] = [];

  try {
    const { data: clients, error } = await sb
      .from("ag_price_alert_clients")
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
        const commodities: string[] = client.commodities || [];
        const thresholds: Record<string, { low?: number; high?: number }> =
          client.alert_thresholds || {};

        // Fetch price data for each commodity
        const priceData: Record<string, string> = {};
        for (const commodity of commodities) {
          const futures = await firecrawlSearch(
            `${commodity} futures price today CME`
          );
          const cash = await firecrawlSearch(
            `USDA ${commodity} cash price report`
          );
          priceData[commodity] = `FUTURES:\n${futures}\n\nCASH:\n${cash}`;
        }

        const priceDataText = Object.entries(priceData)
          .map(([c, d]) => `=== ${c.toUpperCase()} ===\n${d}`)
          .join("\n\n");

        const thresholdText = JSON.stringify(thresholds, null, 2);

        const prompt = `You are an expert agricultural commodities analyst. Today is ${today}.

CLIENT: ${client.name || client.email}
COMMODITIES TRACKED: ${commodities.join(", ")}
ALERT THRESHOLDS ($ per bushel/unit): ${thresholdText}

CURRENT MARKET DATA FROM WEB:
${priceDataText}

Your task:
1. Extract the current price for each commodity from the data above (best estimate from the sources).
2. Check if any price has crossed a threshold (below low or above high).
3. Write a professional morning market brief covering:
   - Current prices for each tracked commodity (state the price clearly)
   - Weather impact on prices (if any mentioned)
   - Export demand trends
   - Upcoming USDA reports this week
   - Key market movers today
   - Overall market sentiment (bullish/bearish/neutral for each commodity)

FORMAT YOUR RESPONSE AS JSON:
{
  "thresholdAlerts": [
    { "commodity": "corn", "currentPrice": 4.52, "threshold": "low: 4.50", "message": "ALERT: Corn below $4.50 — currently $4.52" }
  ],
  "briefHtml": "<full HTML morning market brief, nicely formatted with headers and bullet points>",
  "briefSummary": "One sentence SMS-friendly summary of today's market"
}`;

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
          thresholdAlerts?: Array<{
            commodity: string;
            currentPrice: number;
            threshold: string;
            message: string;
          }>;
          briefHtml?: string;
          briefSummary?: string;
        } = {};
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch {
          parsed = { briefHtml: rawText, thresholdAlerts: [] };
        }

        const alerts = parsed.thresholdAlerts || [];
        const hasAlert = alerts.length > 0;
        const subject = hasAlert
          ? `🚨 ALERT: Commodity Price Threshold Hit — ${today}`
          : `📊 Morning Market Brief — ${today}`;

        const alertHtml = hasAlert
          ? `<div style="background:#fee2e2;border:2px solid #dc2626;padding:16px;border-radius:8px;margin-bottom:24px;">
              <h2 style="color:#dc2626;margin:0 0 8px;">⚠️ Price Alert Triggered</h2>
              ${alerts
                .map(
                  (a) =>
                    `<p style="margin:4px 0;font-weight:bold;">${a.message}</p>`
                )
                .join("")}
            </div>`
          : "";

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#1e293b;}
  h1{color:#e8621a;border-bottom:2px solid #e8621a;padding-bottom:8px;}
  h2{color:#1e293b;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;}
</style></head>
<body>
<h1>M² Ag Price Intelligence</h1>
<p style="color:#64748b;">${today} | Good morning, ${client.name || "Farmer"}!</p>
${alertHtml}
${parsed.briefHtml || "<p>Market data unavailable. Please check back later.</p>"}
<div class="footer">
  <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;vertical-align:middle;margin-right:8px;" alt="Matt">
  <span>Matt Michels | M2 Development | matt@mattmichelstraining.com | (313) 806-4952</span>
</div>
</body>
</html>`;

        await sendEmail(client.email, subject, html);

        if (hasAlert && client.phone) {
          const smsBody =
            `🚨 M² Ag Alert: ` +
            alerts.map((a) => a.message).join("; ") +
            ` | ${parsed.briefSummary || ""} | mattmichelstraining.com`;
          await sendSMS(client.phone, TWILIO_PHONE_NUMBER, smsBody.slice(0, 1600), "ag_price_alerts");
        }

        // Update last_alert_at if threshold hit
        if (hasAlert) {
          await sb
            .from("ag_price_alert_clients")
            .update({ last_alert_at: new Date().toISOString() })
            .eq("id", client.id);
        }

        results.push(`✓ ${client.email} — alerts: ${alerts.length}`);
      } catch (clientErr) {
        results.push(`✗ ${client.email} — ${clientErr}`);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ag-price-alerts error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
