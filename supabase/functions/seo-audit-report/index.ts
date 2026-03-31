import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";

interface KeywordResult {
  keyword: string;
  position: number | null;
  url: string | null;
}

async function fetchKeywordRankings(keywords: string[], location: string): Promise<KeywordResult[]> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return [];

  const credentials = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
  const results: KeywordResult[] = [];

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json" },
        body: JSON.stringify([{
          keyword,
          location_name: location || "Michigan,United States",
          language_name: "English",
          depth: 30 }]) });

      if (!res.ok) continue;
      const data = await res.json();
      const items: any[] = data.tasks?.[0]?.result?.[0]?.items || [];
      const organic = items.find((i: any) => i.type === "organic");

      results.push({
        keyword,
        position: organic?.rank_absolute ?? null,
        url: organic?.url ?? null });
    } catch {
      results.push({ keyword, position: null, url: null });
    }
  }

  return results;
}

async function generateReport(client: any, rankings: KeywordResult[]): Promise<string> {
  if (!LOVABLE_API_KEY) return "";

  const hasRankings = rankings.length > 0;
  const rankingText = hasRankings
    ? rankings.map(r => r.position ? `"${r.keyword}" — position #${r.position}` : `"${r.keyword}" — not in top 30`).join("\n")
    : "No keyword data available (DataForSEO not connected).";

  const prompt = hasRankings
    ? `You are a local SEO expert writing a monthly report for ${client.business_name}, a local business${client.location ? ` in ${client.location}` : ""}.\n\nCurrent Google keyword rankings:\n${rankingText}\n\nWrite a concise monthly SEO report in plain English. Include:\n1. A brief overall assessment (2-3 sentences)\n2. What's working\n3. Top 5 prioritized action items to improve rankings this month (numbered list, specific and actionable)\n\nKeep it under 600 words. Write like a knowledgeable friend, not a consultant.`
    : `You are a local SEO expert writing a monthly report for ${client.business_name}${client.location ? ` in ${client.location}` : ""}. Target keywords: ${(client.target_keywords || []).join(", ") || "not specified"}.\n\nWrite a helpful monthly local SEO report in plain English. Since we don't have live ranking data this month, focus on:\n1. A brief assessment of what typically matters most for local businesses like this\n2. Top 5 prioritized action items to improve local search visibility this month (numbered list, specific and actionable)\n3. One quick win they can do today\n\nKeep it under 600 words. Write like a knowledgeable friend, not a consultant.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite", 
      messages: [{ role: "user", content: prompt }] }) });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

function buildEmailHtml(client: any, reportText: string, rankings: KeywordResult[], month: string): string {
  const rankingRows = rankings.length > 0
    ? rankings.map(r => `
        <tr>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;">${r.keyword}</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;font-weight:700;text-align:center;color:${r.position && r.position <= 10 ? "#16a34a" : r.position ? "#e8621a" : "#94a3b8"};">
            ${r.position ? `#${r.position}` : "Not in top 30"}
          </td>
        </tr>`).join("")
    : "";

  const reportHtml = reportText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      if (/^\d+\./.test(line)) return `<li style="font-size:14px;color:#1e293b;line-height:1.7;margin-bottom:6px;">${line.replace(/^\d+\.\s*/, "")}</li>`;
      if (line.startsWith("#")) return `<h3 style="font-size:15px;font-weight:900;color:#1e293b;margin:20px 0 8px;">${line.replace(/^#+\s*/, "")}</h3>`;
      return `<p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 12px;">${line}</p>`;
    })
    .join("")
    .replace(/(<li[^>]*>.*<\/li>)+/gs, match => `<ol style="padding-left:20px;margin:8px 0 16px;">${match}</ol>`);

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;">
      <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#e8621a;margin-bottom:8px;">M² SEO Reports</p>
      <h1 style="font-size:22px;font-weight:900;margin:0 0 4px;">${client.business_name}</h1>
      <p style="font-size:14px;color:#64748b;margin:0 0 28px;">Monthly SEO Report — ${month}</p>

      ${rankings.length > 0 ? `
        <h2 style="font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:10px;">Keyword Rankings</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
          <thead>
            <tr>
              <th style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:11px;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Keyword</th>
              <th style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:11px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:0.05em;">Position</th>
            </tr>
          </thead>
          <tbody>${rankingRows}</tbody>
        </table>
      ` : ""}

      <h2 style="font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:14px;">Analysis & Action Items</h2>
      <div style="margin-bottom:28px;">${reportHtml}</div>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;" />
        <div>
          <p style="font-size:13px;font-weight:700;margin:0;">Matt Michels</p>
          <p style="font-size:12px;color:#64748b;margin:0;">M² Performance Training — (313) 806-4952 — matt@m2training.com</p>
        </div>
      </div>
    </div>
  `;
}

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: clients } = await sb
      .from("seo_report_clients")
      .select("id, business_name, email, location, target_keywords, last_report_at")
      .eq("active", true);

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const now = new Date();
    const month = now.toLocaleString("en-US", { month: "long", year: "numeric" });
    let sent = 0;

    for (const client of clients) {
      const keywords: string[] = client.target_keywords || [];
      const rankings = await fetchKeywordRankings(keywords, client.location || "Michigan,United States");
      const reportText = await generateReport(client, rankings);

      if (!reportText) {
        console.log(`[SEO-AUDIT] ${client.business_name}: no report text generated, skipping`);
        continue;
      }

      if (RESEND_API_KEY && client.email) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² SEO Reports <matt@notify.m2training.com>",
            to: [client.email],
            subject: `Your ${month} SEO Report — ${client.business_name}`,
            html: buildEmailHtml(client, reportText, rankings, month) }) });

        if (res.ok) {
          await sb.from("seo_report_clients").update({ last_report_at: now.toISOString() }).eq("id", client.id);
          sent++;
          console.log(`[SEO-AUDIT] Sent report to ${client.business_name} (${client.email})`);
        } else {
          console.error(`[SEO-AUDIT] Failed to send to ${client.email}: ${res.status}`);
        }
      }
    }

    return new Response(JSON.stringify({ processed: clients.length, sent }), { status: 200 });
  } catch (e: any) {
    console.error("[SEO-AUDIT] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
