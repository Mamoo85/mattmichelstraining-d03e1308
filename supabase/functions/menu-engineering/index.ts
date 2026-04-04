// menu-engineering — HTTP POST
// Receives menu + sales data, runs BCG matrix analysis via Claude,
// stores report in menu_reports, emails restaurant.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { clientId, menuData, salesData } = body as {
      clientId: string;
      menuData: string;
      salesData: string;
    };

    if (!clientId || !menuData || !salesData) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: clientId, menuData, salesData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch client
    const { data: client, error: clientErr } = await sb
      .from("menu_engineering_clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const restaurantName = client.restaurant_name || client.name;
    const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const prompt = `You are a restaurant profitability consultant specializing in menu engineering. Conduct a full BCG matrix analysis.

RESTAURANT: ${restaurantName}
REPORT PERIOD: ${month}

MENU DATA (items with prices):
${menuData}

SALES DATA (popularity, volumes, margins):
${salesData}

Conduct a thorough menu engineering analysis using the BCG matrix framework:

STARS (High Popularity + High Margin) — Protect and feature
PLOWHORSES (High Popularity + Low Margin) — Raise price or cut cost
PUZZLES (Low Popularity + High Margin) — Improve placement, rename, or rewrite description
DOGS (Low Popularity + Low Margin) — Remove or completely redesign

For each item, assign it to a quadrant and provide specific, actionable recommendations.

Then calculate the estimated revenue impact of implementing your recommendations.

FORMAT AS JSON:
{
  "stars": [
    { "item": "Item name", "currentPrice": 18.99, "recommendation": "Feature on front page, consider premium positioning", "revenueImpact": "+$X/mo if..." }
  ],
  "plowhorses": [
    { "item": "Item name", "currentPrice": 12.99, "suggestedPrice": 14.99, "costReduction": "Use cheaper cheese blend", "recommendation": "Raise price by $2 OR reduce ingredient cost", "revenueImpact": "+$X/mo" }
  ],
  "puzzles": [
    { "item": "Item name", "currentPrice": 24.99, "recommendation": "Move to prime menu real estate, rewrite description to emphasize premium ingredients", "newName": "Suggested new name if applicable", "revenueImpact": "+$X/mo if sales increase 20%" }
  ],
  "dogs": [
    { "item": "Item name", "recommendation": "Remove from menu OR completely redesign with different ingredients", "reasoning": "Why it's underperforming" }
  ],
  "totalEstimatedImpact": "$X,XXX/mo in additional revenue if all recommendations implemented",
  "topThreeActions": ["Action 1", "Action 2", "Action 3"],
  "executiveSummary": "3-4 sentence executive summary for the restaurant owner",
  "reportHtml": "Beautiful, comprehensive HTML menu engineering report with color-coded quadrant sections, tables, and clear callouts"
}

Make the revenue impact estimates realistic based on a typical restaurant doing $30,000-$150,000/mo in sales.`;

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
      stars?: Array<{ item: string; currentPrice?: number; recommendation: string; revenueImpact?: string }>;
      plowhorses?: Array<{ item: string; currentPrice?: number; suggestedPrice?: number; recommendation: string; revenueImpact?: string }>;
      puzzles?: Array<{ item: string; currentPrice?: number; recommendation: string; newName?: string; revenueImpact?: string }>;
      dogs?: Array<{ item: string; recommendation: string; reasoning?: string }>;
      totalEstimatedImpact?: string;
      topThreeActions?: string[];
      executiveSummary?: string;
      reportHtml?: string;
    } = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = { reportHtml: rawText };
    }

    const reportText = JSON.stringify(parsed, null, 2);

    // Store report
    const { data: report, error: reportErr } = await sb
      .from("menu_reports")
      .insert({
        client_id: clientId,
        restaurant_name: restaurantName,
        period: month,
        menu_data: menuData,
        sales_data: salesData,
        report_json: parsed,
        report_text: reportText,
        stars_count: parsed.stars?.length || 0,
        plowhorses_count: parsed.plowhorses?.length || 0,
        puzzles_count: parsed.puzzles?.length || 0,
        dogs_count: parsed.dogs?.length || 0,
        total_estimated_impact: parsed.totalEstimatedImpact || null,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (reportErr) console.error("Report insert error:", reportErr);

    const reportId = report?.id;

    // Update last_report_at
    await sb
      .from("menu_engineering_clients")
      .update({ last_report_at: new Date().toISOString() })
      .eq("id", clientId);

    // Build section HTML for each quadrant
    const quadrantSection = (
      title: string,
      color: string,
      icon: string,
      description: string,
      items: Array<{ item: string; recommendation: string; revenueImpact?: string; [key: string]: unknown }>
    ) =>
      items?.length
        ? `<div style="border:2px solid ${color};border-radius:12px;padding:20px;margin-bottom:24px;">
          <h2 style="color:${color};margin:0 0 4px;">${icon} ${title}</h2>
          <p style="color:#64748b;font-size:13px;margin:0 0 16px;">${description}</p>
          ${items
            .map(
              (i) =>
                `<div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:8px;">
              <strong>${i.item}</strong>
              <p style="margin:4px 0;color:#475569;font-size:14px;">${i.recommendation}</p>
              ${i.revenueImpact ? `<span style="color:${color};font-size:13px;font-weight:bold;">Impact: ${i.revenueImpact}</span>` : ""}
            </div>`
            )
            .join("")}
        </div>`
        : "";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:750px;margin:0 auto;padding:20px;color:#1e293b;}
  h1{color:#e8621a;border-bottom:2px solid #e8621a;padding-bottom:8px;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;}
</style></head>
<body>
<h1>Menu Engineering Report</h1>
<p style="color:#64748b;">${month} | ${restaurantName}</p>

<div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:20px;margin-bottom:24px;">
  <h2 style="color:#16a34a;margin:0 0 8px;">💰 Estimated Revenue Opportunity</h2>
  <div style="font-size:28px;font-weight:bold;color:#16a34a;">${parsed.totalEstimatedImpact || "See recommendations below"}</div>
  <p style="margin:8px 0 0;color:#475569;">${parsed.executiveSummary || ""}</p>
</div>

${parsed.topThreeActions?.length ? `
<div style="background:#fff8f0;border-left:4px solid #e8621a;padding:16px;margin-bottom:24px;border-radius:0 8px 8px 0;">
  <strong>Top 3 Immediate Actions:</strong>
  <ol style="margin:8px 0 0;padding-left:20px;">
    ${parsed.topThreeActions.map((a) => `<li style="margin-bottom:4px;">${a}</li>`).join("")}
  </ol>
</div>` : ""}

${quadrantSection("Stars", "#16a34a", "⭐", "High popularity, high margin — your best performers. Protect these and feature them prominently.", parsed.stars || [])}
${quadrantSection("Plowhorses", "#d97706", "🐴", "High popularity, low margin — customers love them but they don't make you much money. Adjust price or reduce cost.", parsed.plowhorses || [])}
${quadrantSection("Puzzles", "#7c3aed", "🧩", "Low popularity, high margin — hidden gems. Better placement, naming, or descriptions can unlock their potential.", parsed.puzzles || [])}
${quadrantSection("Dogs", "#dc2626", "🐕", "Low popularity, low margin — these items are costing you money. Consider removing or completely redesigning.", parsed.dogs || [])}

${parsed.reportHtml || ""}

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
        subject: `🍽️ Menu Engineering Report — ${month} | ${parsed.totalEstimatedImpact || "Opportunities Found"}`,
        html: emailHtml,
      }),
    });

    return new Response(
      JSON.stringify({ success: true, reportId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("menu-engineering error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
