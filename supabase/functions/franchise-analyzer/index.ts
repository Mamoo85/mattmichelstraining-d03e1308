// Franchise FDD Analyzer — HTTP POST from client dashboard
// Analyzes Franchise Disclosure Document text via Claude, returns structured report

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { clientId, franchiseName, documentText } = await req.json();

    if (!clientId || !documentText) {
      return new Response(
        JSON.stringify({ error: "clientId and documentText are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch client
    const { data: client, error: clientErr } = await sb
      .from("franchise_analyzer_clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fddName = franchiseName || "Franchise";
    const todayStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    // Truncate document text to fit within token limits (roughly 6000 chars)
    const truncatedDoc = documentText.length > 6000
      ? documentText.slice(0, 6000) + "\n\n[Document truncated for analysis — key sections above]"
      : documentText;

    const prompt = `You are an expert franchise attorney and business analyst. Analyze the following Franchise Disclosure Document (FDD) text for a prospective franchisee. Be thorough, honest, and protect the buyer.

Franchise: ${fddName}
Analysis Date: ${todayStr}

FDD Text / Key Sections Provided:
${truncatedDoc}

Analyze this FDD and return a JSON object with EXACTLY these fields:

{
  "initial_franchise_fee": "string — the upfront fee to buy the franchise",
  "royalty_rate": "string — ongoing royalty percentage of gross sales",
  "marketing_fund": "string — required marketing/ad fund contribution",
  "territory": "string — territory size, exclusivity, and any encroachment rights",
  "term_and_renewal": "string — initial term length, renewal options, and conditions",
  "termination_conditions": "string — what causes the franchisor to terminate the agreement (key triggers)",
  "item19_summary": "string — financial performance representation if provided, or 'Not disclosed (Item 19 not provided)'",
  "item20_summary": "string — number of franchisees in system, outlets opened/closed last 3 years, closure rate estimate",
  "red_flags": ["string", "string", "string", "string", "string"],
  "risk_score": number,
  "risk_score_explanation": "string — 2-3 sentences explaining the risk score",
  "executive_summary": "string — 400-word plain English summary covering: what this franchise offers, cost structure, key risks, key positives, and bottom-line recommendation for a cautious buyer"
}

For risk_score: 1-100 where 100 = extremely high risk. Score above 70 means serious concerns. Score below 40 means relatively franchise-friendly.

For red_flags: List exactly 5, even if some are minor. Be specific — cite actual numbers or clauses from the document when possible.

Return ONLY the JSON object, no other text.`;

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
    const rawText = aiData?.content?.[0]?.text || "{}";

    let analysis: Record<string, unknown> = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch?.[0] || "{}");
    } catch {
      console.error("[franchise-analyzer] JSON parse error");
      analysis = { executive_summary: rawText, risk_score: 50, red_flags: [] };
    }

    // Store result
    const { data: analysisRecord, error: insertErr } = await sb
      .from("franchise_analyses")
      .insert({
        client_id: clientId,
        franchise_name: fddName,
        analysis_data: analysis,
        risk_score: analysis.risk_score || null,
        executive_summary: analysis.executive_summary || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[franchise-analyzer] Insert error:", insertErr);
    }

    // Increment documents_analyzed
    await sb
      .from("franchise_analyzer_clients")
      .update({ documents_analyzed: (client.documents_analyzed || 0) + 1 })
      .eq("id", clientId);

    // Build risk color
    const riskScore = Number(analysis.risk_score) || 50;
    const riskColor = riskScore >= 70 ? "#dc2626" : riskScore >= 50 ? "#d97706" : "#16a34a";
    const riskLabel = riskScore >= 70 ? "HIGH RISK" : riskScore >= 50 ? "MODERATE RISK" : "LOWER RISK";

    const redFlagsHtml = Array.isArray(analysis.red_flags)
      ? (analysis.red_flags as string[])
          .map((flag) => `<li style="margin:0 0 8px;font-size:14px;color:#1e293b;line-height:1.6;">${flag}</li>`)
          .join("")
      : "";

    const metricRow = (label: string, value: unknown) =>
      `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;font-weight:600;width:40%;">${label}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;">${String(value || "Not specified")}</td>
      </tr>`;

    const reportHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">

  <tr><td style="background:#1e293b;padding:24px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">M² Franchise Analyzer</p>
    <p style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700;">${fddName} — FDD Analysis</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${todayStr}</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

    <!-- Risk Score -->
    <div style="text-align:center;background:${riskColor}14;border:2px solid ${riskColor};border-radius:12px;padding:24px;margin:0 0 28px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${riskColor};letter-spacing:2px;text-transform:uppercase;">${riskLabel}</p>
      <p style="margin:0;font-size:52px;font-weight:900;color:${riskColor};">${riskScore}<span style="font-size:24px;">/100</span></p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">${String(analysis.risk_score_explanation || "")}</p>
    </div>

    <!-- Key Terms Table -->
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:2px;color:#64748b;text-transform:uppercase;">Key Financial Terms</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 28px;">
      ${metricRow("Initial Franchise Fee", analysis.initial_franchise_fee)}
      ${metricRow("Ongoing Royalty", analysis.royalty_rate)}
      ${metricRow("Marketing Fund", analysis.marketing_fund)}
      ${metricRow("Territory", analysis.territory)}
      ${metricRow("Term & Renewal", analysis.term_and_renewal)}
    </table>

    <!-- Red Flags -->
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:2px;color:#dc2626;text-transform:uppercase;">Top 5 Red Flags</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin:0 0 28px;">
      <ul style="margin:0;padding:0 0 0 20px;">${redFlagsHtml}</ul>
    </div>

    <!-- Item 19 & 20 -->
    ${analysis.item19_summary ? `
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;color:#64748b;text-transform:uppercase;">Item 19 — Financial Performance</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.7;">${String(analysis.item19_summary)}</p>
    </div>` : ""}

    ${analysis.item20_summary ? `
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;color:#64748b;text-transform:uppercase;">Item 20 — Franchisee System Health</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin:0 0 28px;">
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.7;">${String(analysis.item20_summary)}</p>
    </div>` : ""}

    <!-- Executive Summary -->
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;color:#e8621a;text-transform:uppercase;">Executive Summary</p>
    <div style="background:#fff7ed;border-left:4px solid #e8621a;padding:20px 24px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;">${String(analysis.executive_summary || "").replace(/\n/g, "<br>")}</p>
    </div>

    <div style="background:#f1f5f9;border-radius:8px;padding:16px 20px;">
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.7;"><strong>Disclaimer:</strong> This analysis is generated by AI and is for informational purposes only. It is not legal or financial advice. Always consult a franchise attorney before signing any FDD or franchise agreement.</p>
    </div>

  </td></tr>

  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M² Franchise Analyzer · (313) 806-4952</div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    // Email client
    if (RESEND_API_KEY && client.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Franchise Analyzer <matt@mattmichelstraining.com>",
          to: [client.email],
          subject: `FDD Analysis Complete — ${fddName} (Risk Score: ${riskScore}/100)`,
          html: reportHtml,
        }),
      });
    }

    // Notify Matt
    await notifyMatt(
      `Franchise FDD Analyzed — ${fddName} | Risk: ${riskScore}/100`,
      `<div style="font-family:sans-serif;max-width:500px;padding:24px;">
<h2 style="color:#e8621a;">New FDD Analysis</h2>
<p><strong>Franchise:</strong> ${fddName}</p>
<p><strong>Client:</strong> ${client.business_name || client.email}</p>
<p><strong>Risk Score:</strong> <span style="color:${riskColor};font-weight:700;">${riskScore}/100 ${riskLabel}</span></p>
<p><strong>Analysis ID:</strong> ${analysisRecord?.id || "N/A"}</p>
<p><strong>Total analyzed this client:</strong> ${(client.documents_analyzed || 0) + 1}</p>
</div>`
    );

    console.log(`[franchise-analyzer] Analysis ${analysisRecord?.id} complete — ${fddName} risk: ${riskScore}/100`);
    return new Response(
      JSON.stringify({ success: true, analysisId: analysisRecord?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[franchise-analyzer] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
