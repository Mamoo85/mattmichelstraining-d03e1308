import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

async function sonarResearch(query: string): Promise<string> {
  if (!OPENROUTER_API_KEY) return "";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://mattmichelstraining.com",
        "X-Title": "M2 Competitor Watch",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: query }],
        max_tokens: 600,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "";
  } catch { return ""; }
}

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("competitor_watch_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    let sent = 0;
    for (const client of clients) {
      try {
        let competitorData = "";
        const urls = client.competitor_urls || [];

        // Step 1: Live web research per competitor via Sonar
        for (const url of urls.slice(0, 3)) {
          const sonarIntel = await sonarResearch(
            `What are the latest changes, promotions, new services, and news for the business at ${url}? Include any recent marketing campaigns, pricing changes, or customer feedback.`
          );
          if (sonarIntel) {
            competitorData += `\n\n## ${url} — Live Web Intel\n${sonarIntel}`;
          }
        }

        // Step 2: Scrape each competitor URL with Firecrawl
        if (FIRECRAWL_API_KEY && urls.length > 0) {
          for (const url of urls.slice(0, 3)) {
            try {
              const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
              });
              const scrapeData = await scrapeRes.json();
              const md = scrapeData?.data?.markdown || scrapeData?.markdown || "";
              competitorData += `\n\n## ${url} — Website Content\n${md.slice(0, 1500)}`;
            } catch { competitorData += `\n\n## ${url}\nCould not scrape.`; }
          }
        }

        if (!competitorData) {
          competitorData = "No competitor URLs configured. Please provide competitor website URLs to enable scraping.";
        }

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: `You are a competitive intelligence analyst. Analyze these competitor websites for "${client.business_name}" (${client.industry || "local business"}).\n\nCompetitor Data (includes live web research and scraped content):\n${competitorData}\n\nProvide:\n1. Key changes or updates noticed\n2. Pricing intelligence (if visible)\n3. New services or promotions they're running\n4. Their messaging strengths and weaknesses\n5. 3 actionable recommendations for ${client.business_name}\n\nFormat as clean HTML with h3 section headings.` }],
          }),
        });
        const aiData = await aiRes.json();
        const report = aiData?.choices?.[0]?.message?.content || "<p>Competitor analysis unavailable this week.</p>";

        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Competitor Watch <matt@mattmichelstraining.com>",
              to: [client.email],
              bcc: ["matthewmichels4@gmail.com"],
              subject: `Weekly Competitor Intel — ${client.business_name}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">🔍 Weekly Competitor Watch</h2><p style="color:#94a3b8;">Intelligence report for ${client.business_name}</p><hr style="border-color:#334155;">${report}<hr style="border-color:#334155;"><p style="color:#64748b;font-size:12px;">Powered by M2 Development — matt@mattmichelstraining.com</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 992-1219
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>`,
            }),
          });
        }

        await sb.from("competitor_watch_clients").update({ report_count: (client.report_count || 0) + 1, last_report_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[COMPETITOR-WATCH] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});
