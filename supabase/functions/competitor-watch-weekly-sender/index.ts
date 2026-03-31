import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

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

        // Scrape each competitor URL
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
              competitorData += `\n\n## ${url}\n${md.slice(0, 1500)}`;
            } catch { competitorData += `\n\n## ${url}\nCould not scrape.`; }
          }
        }

        if (!competitorData) {
          competitorData = "No competitor URLs configured. Please provide competitor website URLs to enable scraping.";
        }

        const aiRes = await fetch("https://ai.lovable.dev/api/chat", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: `You are a competitive intelligence analyst. Analyze these competitor websites for "${client.business_name}" (${client.industry || "local business"}).\n\nCompetitor Data:\n${competitorData}\n\nProvide:\n1. Key changes or updates noticed\n2. Pricing intelligence (if visible)\n3. New services or promotions they're running\n4. Their messaging strengths and weaknesses\n5. 3 actionable recommendations for ${client.business_name}\n\nFormat as clean HTML with h3 section headings.` }],
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
              subject: `Weekly Competitor Intel — ${client.business_name}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">🔍 Weekly Competitor Watch</h2><p style="color:#94a3b8;">Intelligence report for ${client.business_name}</p><hr style="border-color:#334155;">${report}<hr style="border-color:#334155;"><p style="color:#64748b;font-size:12px;">Powered by M² Performance — matt@m2training.com</p></div>`,
            }),
          });
        }

        await sb.from("competitor_watch_clients").update({ report_count: (client.report_count || 0) + 1, last_report_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[COMPETITOR-WATCH] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: any) { console.error("[COMPETITOR-WATCH] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
