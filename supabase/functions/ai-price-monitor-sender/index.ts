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
    const { data: clients } = await sb.from("price_monitor_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    let sent = 0;
    for (const client of clients) {
      try {
        let pricingData = "";
        const urls = client.competitor_urls || [];

        if (FIRECRAWL_API_KEY && urls.length > 0) {
          for (const url of urls.slice(0, 5)) {
            try {
              const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
              });
              const data = await res.json();
              pricingData += `\n\n## ${url}\n${(data?.data?.markdown || data?.markdown || "").slice(0, 1000)}`;
            } catch { pricingData += `\n\n## ${url}\nCould not scrape.`; }
          }
        }

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: `Analyze competitor pricing for "${client.business_name}" (${client.industry || "business"}).\n\nCompetitor websites scraped:\n${pricingData || "No data available."}\n\nProvide:\n1. Pricing comparison table (if prices found)\n2. New services or promotions detected\n3. Pricing strategy recommendations\n4. Market positioning analysis\n\nFormat as clean HTML.` }],
          }),
        });
        const aiData = await aiRes.json();
        const report = aiData?.choices?.[0]?.message?.content || "<p>Report unavailable.</p>";

        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Price Monitor <matt@mattmichelstraining.com>",
              to: [client.email],
              subject: `Weekly Price Intel — ${client.business_name}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">💰 Competitor Price Monitor</h2>${report}<hr style="border-color:#334155;"><p style="color:#64748b;font-size:12px;">Powered by M² Performance</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>`,
            }),
          });
        }

        await sb.from("price_monitor_clients").update({ report_count: (client.report_count || 0) + 1, last_report_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[PRICE-MONITOR] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: any) { console.error("[PRICE-MONITOR] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
