import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── JS Visibility Check ────────────────────────────────────────────────
async function checkJsVisibility(url: string): Promise<{ score: number; gap: boolean; rawLen: number; renderedLen: number }> {
  let rawLen = 0;
  let renderedLen = 0;

  try {
    // Raw fetch (no JS)
    const rawRes = await fetch(url, { headers: { "User-Agent": "M2SEOGuard/1.0" } });
    const rawText = await rawRes.text();
    rawLen = rawText.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().length;
  } catch { rawLen = 0; }

  try {
    // Firecrawl rendered fetch
    if (FIRECRAWL_API_KEY) {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["html"], onlyMainContent: true }),
      });
      const data = await res.json();
      const html = data?.data?.html || data?.html || "";
      renderedLen = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().length;
    }
  } catch { renderedLen = rawLen; }

  if (renderedLen === 0 && rawLen === 0) return { score: 50, gap: false, rawLen: 0, renderedLen: 0 };
  if (renderedLen === 0) return { score: 100, gap: false, rawLen, renderedLen: rawLen };

  const ratio = rawLen / Math.max(renderedLen, 1);
  const score = Math.min(100, Math.round(ratio * 100));
  const gap = ratio < 0.2; // bot sees <20% of rendered content

  return { score, gap, rawLen, renderedLen };
}

// ── Keyword Rank Tracking ──────────────────────────────────────────────
async function getKeywordRanks(keywords: string[], domain: string): Promise<{ ranks: Record<string, number | null>; drops: Record<string, number> }> {
  const ranks: Record<string, number | null> = {};
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD || !keywords?.length) return { ranks, drops: {} };

  const creds = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

  for (const kw of keywords.slice(0, 5)) {
    try {
      const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
        method: "POST",
        headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ keyword: kw, location_code: 2840, language_code: "en", depth: 50 }]),
      });
      const data = await res.json();
      const items = data?.tasks?.[0]?.result?.[0]?.items || [];
      const found = items.find((i: any) => i.domain?.includes(domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0]));
      ranks[kw] = found?.rank_absolute || null;
    } catch {
      ranks[kw] = null;
    }
  }

  return { ranks, drops: {} };
}

// ── AI Summary ─────────────────────────────────────────────────────────
async function generateSummary(clientName: string, data: any): Promise<string> {
  if (!LOVABLE_API_KEY) return "AI summary unavailable.";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: `You are an SEO analyst. Given these metrics for "${clientName}", rank the top 3 issues and give each a 1-sentence fix.

JS Visibility Score: ${data.js_visibility_score}/100 (${data.js_gap_detected ? "GAP DETECTED — bots see <20% of content" : "OK"})
Keyword Rankings: ${JSON.stringify(data.keyword_ranks)}
Rank Drops: ${JSON.stringify(data.rank_drops)}
Indexed Pages: ${data.indexed_pages ?? "unknown"}
De-indexed Pages: ${JSON.stringify(data.deindexed_pages)}

Format as a short numbered list. Be direct and actionable.`,
        }],
        max_tokens: 500,
      }),
    });
    const aiData = await res.json();
    return aiData?.choices?.[0]?.message?.content || "Analysis unavailable.";
  } catch {
    return "AI summary generation failed.";
  }
}

// ── Email Report ───────────────────────────────────────────────────────
async function sendReport(email: string, businessName: string, scan: any, isMonthly: boolean) {
  if (!RESEND_API_KEY) return;

  const alertEmoji = scan.js_gap_detected || (scan.rank_drops && Object.keys(scan.rank_drops).length > 0) ? "🚨" : "✅";
  const subject = isMonthly
    ? `${alertEmoji} Monthly SEO Report — ${businessName}`
    : `${alertEmoji} Weekly SEO Check — ${businessName}`;

  const rankRows = scan.keyword_ranks
    ? Object.entries(scan.keyword_ranks).map(([kw, rank]) => {
        const drop = scan.rank_drops?.[kw];
        const arrow = drop ? ` <span style="color:#ef4444">↓${drop}</span>` : "";
        return `<tr><td style="padding:6px 12px;border-bottom:1px solid #334155">${kw}</td><td style="padding:6px 12px;border-bottom:1px solid #334155">${rank || "50+"}${arrow}</td></tr>`;
      }).join("")
    : "";

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#1e293b;padding:20px 28px;border-bottom:3px solid #e8621a">
    <p style="color:#e8621a;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">M² SEO GUARD</p>
    <h1 style="color:#fff;margin:0;font-size:20px">${subject}</h1>
  </div>
  <div style="padding:24px 28px;color:#1e293b;font-size:15px;line-height:1.8">
    <p><strong>Website:</strong> ${scan.website_url || businessName}</p>
    
    <h3 style="color:#e8621a;margin:20px 0 8px">🔍 JavaScript Visibility</h3>
    <p>Score: <strong>${scan.js_visibility_score}/100</strong> ${scan.js_gap_detected ? '<span style="color:#ef4444;font-weight:700">⚠️ GAP DETECTED</span>' : '<span style="color:#22c55e">✅ OK</span>'}</p>
    
    ${rankRows ? `<h3 style="color:#e8621a;margin:20px 0 8px">📊 Keyword Rankings</h3>
    <table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:6px 12px;background:#f1f5f9">Keyword</th><th style="text-align:left;padding:6px 12px;background:#f1f5f9">Position</th></tr></thead><tbody>${rankRows}</tbody></table>` : ""}
    
    ${isMonthly && scan.ai_summary ? `<h3 style="color:#e8621a;margin:20px 0 8px">🤖 AI Analysis</h3><div style="background:#f8fafc;padding:16px;border-radius:8px;white-space:pre-wrap">${scan.ai_summary}</div>` : ""}
    
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt" style="width:44px;height:44px;border-radius:50%;object-fit:cover" />
      <div style="font-size:13px;color:#64748b">
        <strong style="color:#1e293b">Matt Michels</strong><br>Grosse Pointe, MI · (313) 992-1219
      </div>
    </div>
  </div>
</div></body></html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² SEO Guard <matt@mattmichelstraining.com>",
      to: [email],
      bcc: ["matthewmichels4@gmail.com"],
      subject,
      html,
    }),
  });
}

// ── SMS Alert ──────────────────────────────────────────────────────────
async function sendAlert(phone: string, businessName: string, issues: string[]) {
  if (!phone) return;
  try {
    const { sendSMS } = await import("../_shared/twilio.ts");
    const body = `🚨 SEO Guard Alert for ${businessName}:\n${issues.join("\n")}\n\nReply STOP to opt out.`;
    await sendSMS(phone, Deno.env.get("TWILIO_PHONE_NUMBER") || "", body, "seo_guard");
  } catch (e) {
    console.error("[SEO-GUARD] SMS alert error:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: clients } = await sb
      .from("seo_guard_clients")
      .select("*")
      .eq("active", true);

    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, scanned: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const isFirstMonday = now.getDate() <= 7;
    let scanned = 0;

    for (const client of clients) {
      try {
        console.log(`[SEO-GUARD] Scanning ${client.business_name || client.email}...`);

        // 1. JS Visibility
        const jsCheck = await checkJsVisibility(client.website_url);

        // 2. Keyword Ranks
        const domain = client.website_url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
        const { ranks } = await getKeywordRanks(client.keywords || [], domain);

        // 3. Compare to last scan for rank drops
        const { data: lastScan } = await sb
          .from("seo_guard_scans")
          .select("keyword_ranks")
          .eq("client_id", client.id)
          .order("scan_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        const rankDrops: Record<string, number> = {};
        if (lastScan?.keyword_ranks) {
          for (const [kw, currentRank] of Object.entries(ranks)) {
            const prevRank = (lastScan.keyword_ranks as any)[kw];
            if (prevRank && currentRank && (currentRank as number) - prevRank > 3) {
              rankDrops[kw] = (currentRank as number) - prevRank;
            }
          }
        }

        // 4. Build scan record
        const scanData: any = {
          client_id: client.id,
          scan_date: now.toISOString().split("T")[0],
          js_visibility_score: jsCheck.score,
          js_gap_detected: jsCheck.gap,
          keyword_ranks: ranks,
          rank_drops: Object.keys(rankDrops).length > 0 ? rankDrops : null,
          indexed_pages: null,
          deindexed_pages: null,
          citation_score: null,
        };

        // 5. AI Summary (monthly or if issues detected)
        const hasIssues = jsCheck.gap || Object.keys(rankDrops).length > 0;
        if (isFirstMonday || hasIssues) {
          scanData.ai_summary = await generateSummary(
            client.business_name || client.website_url,
            { ...scanData, website_url: client.website_url }
          );
        }

        // 6. Store scan
        const { data: savedScan } = await sb
          .from("seo_guard_scans")
          .insert(scanData)
          .select()
          .single();

        // 7. SMS Alerts
        if (hasIssues && client.phone) {
          const issues: string[] = [];
          if (jsCheck.gap) issues.push("⚠️ JS gap — Google sees <20% of your site content");
          for (const [kw, drop] of Object.entries(rankDrops)) {
            issues.push(`📉 "${kw}" dropped ${drop} positions`);
          }
          await sendAlert(client.phone, client.business_name || "your site", issues);
          await sb.from("seo_guard_scans").update({ alert_sent: true }).eq("id", savedScan?.id);
        }

        // 8. Email report
        await sendReport(
          client.email,
          client.business_name || client.website_url,
          { ...scanData, website_url: client.website_url },
          isFirstMonday
        );
        await sb.from("seo_guard_scans").update({ report_sent_at: new Date().toISOString() }).eq("id", savedScan?.id);

        // 9. Update client
        await sb.from("seo_guard_clients").update({ last_scan_at: new Date().toISOString() }).eq("id", client.id);
        if (isFirstMonday) {
          await sb.from("seo_guard_clients").update({ last_report_at: new Date().toISOString() }).eq("id", client.id);
        }

        scanned++;
      } catch (e) {
        console.error(`[SEO-GUARD] Error for ${client.email}:`, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, scanned }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[SEO-GUARD] Fatal:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
