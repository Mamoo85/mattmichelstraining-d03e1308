import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DATAFORSEO_LOGIN     = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD  = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY") || "";

interface KW { keyword: string; searchVolume: number; difficulty: number; position: number; }

async function fetchRankedKeywords(domain: string): Promise<KW[]> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return [];
  const credentials = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
  try {
    const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
      body: JSON.stringify([{
        target: domain,
        location_name: "United States",
        language_name: "English",
        limit: 100,
        filters: ["ranked_serp_element.serp_item.rank_absolute", "<=", 30],
      }]),
    });
    if (!res.ok) { console.error(`[KEYWORD-GAP] DataForSEO ${res.status} for ${domain}`); return []; }
    const data = await res.json();
    const items: any[] = data.tasks?.[0]?.result?.[0]?.items || [];
    return items.map((item: any) => ({
      keyword: item.keyword_data?.keyword || "",
      searchVolume: item.keyword_data?.search_volume || 0,
      difficulty: item.keyword_data?.keyword_difficulty || 0,
      position: item.ranked_serp_element?.serp_item?.rank_absolute || 100,
    })).filter(k => k.keyword);
  } catch (e) { console.error(`[KEYWORD-GAP] fetch failed for ${domain}:`, e); return []; }
}

function buildEmail(yourDomain: string, competitorDomain: string, gaps: KW[], aiSummary: string): string {
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const rows = gaps.slice(0, 25).map((k, i) => {
    const vc = k.searchVolume >= 1000 ? "#22c55e" : k.searchVolume >= 200 ? "#eab308" : "#94a3b8";
    const dc = k.difficulty <= 30 ? "#22c55e" : k.difficulty <= 60 ? "#eab308" : "#ef4444";
    const vol = k.searchVolume >= 1000 ? (k.searchVolume / 1000).toFixed(1) + "k" : String(k.searchVolume);
    return `<tr style="border-bottom:1px solid #1e2d4a">
      <td style="padding:10px 14px;font-size:13px;color:#e2e8f0">${i + 1}. ${k.keyword}</td>
      <td style="padding:10px 14px;font-size:13px;color:${vc};text-align:center;font-weight:700">${vol}</td>
      <td style="padding:10px 14px;font-size:13px;color:${dc};text-align:center;font-weight:700">${k.difficulty}/100</td>
    </tr>`;
  }).join("");

  const summaryHtml = aiSummary
    ? aiSummary.split("\n").filter(l => l.trim()).map(l =>
        /^\d+\./.test(l)
          ? `<li style="font-size:14px;color:#cbd5e1;line-height:1.7;margin-bottom:6px">${l.replace(/^\d+\.\s*/, "")}</li>`
          : `<p style="font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 10px">${l}</p>`
      ).join("")
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#060c18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px">
<table width="100%" style="max-width:600px">
  <tr><td style="background:#0a0f1e;padding:22px 28px;border-radius:10px 10px 0 0;border:1px solid #1e2d4a;border-bottom:none">
    <p style="margin:0;color:#00d4ff;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase">Detroit Web Agency · Keyword Gap Report</p>
    <h1 style="margin:6px 0 0;color:#e2e8f0;font-size:20px;font-weight:700">🔍 ${gaps.length} Keyword Gaps Found</h1>
    <p style="margin:4px 0 0;color:#475569;font-size:12px">${date} · ${yourDomain} vs ${competitorDomain}</p>
  </td></tr>
  <tr><td style="background:#0a0f1e;padding:24px 28px;border:1px solid #1e2d4a;border-top:none;border-bottom:none">
    <div style="background:#00d4ff15;border:1px solid #00d4ff30;border-radius:8px;padding:14px 18px;margin-bottom:22px">
      <span style="font-size:13px;color:#67e8f9">Your competitor <strong>${competitorDomain}</strong> ranks for <strong>${gaps.length} keywords</strong> that <strong>${yourDomain}</strong> doesn't appear in the top 30 for.</span>
    </div>
    ${summaryHtml ? `<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:0 0 14px">AI Analysis</h2><div style="margin-bottom:24px">${summaryHtml}</div>` : ""}
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:0 0 10px">Top ${Math.min(gaps.length, 25)} Gaps</h2>
    <table width="100%" style="border-collapse:collapse;margin-bottom:16px">
      <thead><tr style="background:#0d1526">
        <th style="padding:10px 14px;font-size:11px;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.08em;color:#475569">Keyword</th>
        <th style="padding:10px 14px;font-size:11px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:.08em;color:#475569">Monthly Volume</th>
        <th style="padding:10px 14px;font-size:11px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:.08em;color:#475569">Difficulty</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:11px;color:#334155;margin:0">Difficulty: 0-30 = easier · 31-60 = moderate · 61-100 = competitive. Data via DataForSEO.</p>
  </td></tr>
  <tr><td style="background:#0a0f1e;padding:18px 28px;border:1px solid #1e2d4a;border-top:none;border-radius:0 0 10px 10px">
    <p style="margin:0;font-size:12px;color:#475569"><strong style="color:#94a3b8">Matt Michels · Detroit Web Agency</strong><br>
    <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none">(313) 992-1219</a> · detroitwebagent.com</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

serve(async (req) => {
  try {
    const { customer_email, your_domain, competitor_domain, order_id } = await req.json();
    if (!customer_email || !your_domain || !competitor_domain) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log(`[KEYWORD-GAP] ${your_domain} vs ${competitor_domain} for ${customer_email}`);

    const [yourKeywords, competitorKeywords] = await Promise.all([
      fetchRankedKeywords(your_domain),
      fetchRankedKeywords(competitor_domain),
    ]);

    const yourSet = new Set(yourKeywords.map(k => k.keyword.toLowerCase()));
    const gaps = competitorKeywords
      .filter(k => !yourSet.has(k.keyword.toLowerCase()))
      .sort((a, b) => b.searchVolume - a.searchVolume)
      .slice(0, 50);

    let aiSummary = "";
    if (gaps.length > 0) {
      const topList = gaps.slice(0, 15).map((k, i) =>
        `${i + 1}. "${k.keyword}" — ${k.searchVolume}/mo, difficulty ${k.difficulty}/100`
      ).join("\n");
      try {
        aiSummary = await generateText(
          `SEO keyword gap: ${your_domain} needs to rank for keywords that ${competitor_domain} already ranks for:\n\n${topList}\n\nWrite 2 sentences of analysis then list the top 5 easiest wins (high volume, low difficulty). Be specific. No fluff.`,
          500
        ) || "";
      } catch {
        aiSummary = `${competitor_domain} has a clear SEO advantage across ${gaps.length} keyword areas. Focus on the low-difficulty, high-volume keywords first — these are your fastest path to closing the gap.`;
      }
    }

    if (RESEND_API_KEY) {
      const subject = gaps.length > 0
        ? `🔍 ${gaps.length} Keyword Gaps Found — ${your_domain} vs ${competitor_domain}`
        : `📊 Keyword Analysis Complete — ${your_domain} vs ${competitor_domain}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [customer_email],
          bcc: ["matthewmichels4@gmail.com"],
          subject,
          html: buildEmail(your_domain, competitor_domain, gaps, aiSummary),
        }),
      });
    }

    if (order_id) {
      await sb.from("keyword_gap_orders").update({
        gaps_found: gaps.length,
        report_sent_at: new Date().toISOString(),
      }).eq("id", order_id);
    }

    console.log(`[KEYWORD-GAP] Done — ${gaps.length} gaps, ${your_domain} vs ${competitor_domain}`);
    return new Response(JSON.stringify({ gaps: gaps.length }), { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[KEYWORD-GAP] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
