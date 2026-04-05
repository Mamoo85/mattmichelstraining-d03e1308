// price-intelligence-scanner — cron daily 6am ET (0 11 * * *)
// Scrapes competitor URLs via Firecrawl, compares prices to stored data,
// alerts client on changes via SMS + email. Weekly report every Monday.

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

async function scrapeUrl(url: string): Promise<string> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return (data.data?.markdown || "").slice(0, 2000);
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const isMonday = now.getUTCDay() === 1;
  const todayStr = now.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
  });
  const results: string[] = [];

  try {
    const { data: clients, error } = await sb
      .from("price_intelligence_clients")
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
        const competitorUrls: string[] = (client.competitor_urls || "")
          .split(",")
          .map((u: string) => u.trim())
          .filter(Boolean);

        if (competitorUrls.length === 0) {
          results.push(`⚠ ${client.email} — no competitor URLs configured`);
          continue;
        }

        // Scrape each competitor URL
        const scrapedData: Array<{ url: string; content: string }> = [];
        for (const url of competitorUrls.slice(0, 5)) {
          const content = await scrapeUrl(url);
          scrapedData.push({ url, content });
        }

        // Fetch last stored prices
        const { data: lastPrices } = await sb
          .from("price_tracking")
          .select("*")
          .eq("client_id", client.id)
          .order("scanned_at", { ascending: false })
          .limit(20);

        const lastPricesText = lastPrices?.length
          ? lastPrices
              .map((p) => `${p.competitor_url}: ${p.product_name} = $${p.price}`)
              .join("\n")
          : "No previous prices on record.";

        const scrapedText = scrapedData
          .map((d) => `URL: ${d.url}\n${d.content}`)
          .join("\n\n---\n\n");

        const prompt = `You are a competitive pricing intelligence analyst. Analyze competitor pricing data.

CLIENT BUSINESS: ${client.business_name || client.name}
CLIENT INDUSTRY: ${client.industry || "general"}
TODAY: ${todayStr}

PREVIOUSLY STORED PRICES:
${lastPricesText}

FRESH SCRAPED COMPETITOR DATA:
${scrapedText}

Your tasks:
1. Extract all prices you can find from the scraped data (product name, price, competitor URL)
2. Compare to previously stored prices to identify any changes
3. Calculate % change for any changed prices
4. Generate strategic analysis and recommendations

FORMAT AS JSON:
{
  "currentPrices": [
    { "competitorUrl": "url", "productName": "Product X", "price": 99.99, "priceText": "$99.99/mo" }
  ],
  "priceChanges": [
    { "competitorUrl": "url", "productName": "Product X", "oldPrice": 89.99, "newPrice": 99.99, "pctChange": 11.1, "direction": "up" }
  ],
  "hasChanges": true/false,
  "strategicAnalysis": "3-4 sentences on what the price changes mean strategically",
  "recommendation": "Specific, actionable recommendation for ${client.business_name || "the client"} based on competitor pricing",
  "weeklyReportHtml": "Full HTML weekly pricing intelligence report with tables and analysis",
  "alertSmsText": "SMS alert text if changes found (max 160 chars) or null"
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
          currentPrices?: Array<{ competitorUrl: string; productName: string; price: number; priceText: string }>;
          priceChanges?: Array<{ competitorUrl: string; productName: string; oldPrice: number; newPrice: number; pctChange: number; direction: string }>;
          hasChanges?: boolean;
          strategicAnalysis?: string;
          recommendation?: string;
          weeklyReportHtml?: string;
          alertSmsText?: string;
        } = {};
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch {
          parsed = { weeklyReportHtml: rawText, hasChanges: false };
        }

        // Store new price records
        if (parsed.currentPrices?.length) {
          const rows = parsed.currentPrices.map((p) => ({
            client_id: client.id,
            competitor_url: p.competitorUrl,
            product_name: p.productName,
            price: p.price,
            price_text: p.priceText,
            scanned_at: new Date().toISOString(),
          }));
          await sb.from("price_tracking").insert(rows);
        }

        // Alert on price changes
        if (parsed.hasChanges && parsed.priceChanges?.length) {
          const changesHtml = parsed.priceChanges
            .map(
              (c) => `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${c.productName}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${c.competitorUrl}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">$${c.oldPrice}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:${c.direction === "up" ? "#dc2626" : "#16a34a"};font-weight:bold;">$${c.newPrice} (${c.direction === "up" ? "+" : ""}${c.pctChange.toFixed(1)}%)</td>
              </tr>`
            )
            .join("");

          const alertHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:750px;margin:0 auto;padding:20px;color:#1e293b;}
  h1{color:#e8621a;}
  table{width:100%;border-collapse:collapse;margin:16px 0;}
  th{background:#1e293b;color:#fff;padding:10px;text-align:left;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;}
</style></head>
<body>
<h1>🔔 Competitor Price Change Alert</h1>
<p style="color:#64748b;">${todayStr}</p>
<table>
  <thead><tr><th>Product</th><th>Competitor</th><th>Old Price</th><th>New Price</th></tr></thead>
  <tbody>${changesHtml}</tbody>
</table>
<div style="background:#f8fafc;border-left:4px solid #e8621a;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
  <strong>Strategic Analysis:</strong><br>${parsed.strategicAnalysis || ""}
  <br><br><strong>Recommendation:</strong><br>${parsed.recommendation || ""}
</div>
<div class="footer">
  <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;vertical-align:middle;margin-right:8px;" alt="Matt">
  <span>Matt Michels | M2 Development | matt@mattmichelstraining.com</span>
</div>
</body>
</html>`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@mattmichelstraining.com>",
              to: [client.email],
              subject: `🔔 Competitor Price Change Detected — ${todayStr}`,
              html: alertHtml,
            }),
          });

          if (client.phone && parsed.alertSmsText) {
            await sendSMS(
              client.phone,
              TWILIO_PHONE_NUMBER,
              `M² Price Alert: ${parsed.alertSmsText} | Details sent to your email.`,
              "price_intelligence"
            );
          }
        }

        // Weekly report on Mondays regardless of changes
        if (isMonday && parsed.weeklyReportHtml) {
          const weeklyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:750px;margin:0 auto;padding:20px;color:#1e293b;}
  h1{color:#e8621a;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;}
</style></head>
<body>
<h1>Weekly Competitor Price Intelligence Report</h1>
<p style="color:#64748b;">Week of ${todayStr}</p>
${parsed.weeklyReportHtml}
<div class="footer">
  <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;vertical-align:middle;margin-right:8px;" alt="Matt">
  <span>Matt Michels | M2 Development | matt@mattmichelstraining.com</span>
</div>
</body>
</html>`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@mattmichelstraining.com>",
              to: [client.email],
              subject: `📊 Weekly Price Intelligence Report — ${todayStr}`,
              html: weeklyHtml,
            }),
          });
        }

        // Update last_scan_at
        await sb
          .from("price_intelligence_clients")
          .update({ last_scan_at: new Date().toISOString() })
          .eq("id", client.id);

        results.push(
          `✓ ${client.email} — changes: ${parsed.priceChanges?.length || 0}, prices tracked: ${parsed.currentPrices?.length || 0}`
        );
      } catch (clientErr) {
        results.push(`✗ ${client.email} — ${clientErr}`);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("price-intelligence-scanner error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
